'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'

/**
 * Reads the one-time token from the emailed link and confirms the deletion.
 * Runs once on mount. Shows the outcome; the token is single-use, so a refresh
 * that re-posts will correctly report "already used".
 */
export default function DeleteAccountConfirm() {
	const params = useSearchParams()
	const token = params.get('token') ?? ''
	const [state, setState] = useState<'working' | 'done' | 'error'>('working')
	const [message, setMessage] = useState('')
	const ran = useRef(false)

	useEffect(() => {
		if (ran.current) return
		ran.current = true
		if (!token) {
			setState('error')
			setMessage('This link is missing its confirmation token.')
			return
		}
		;(async () => {
			try {
				const res = await fetch('/api/deletion/confirm', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ token }),
				})
				const data = await res.json().catch(() => ({}))
				if (res.ok) {
					setState('done')
				} else {
					setState('error')
					setMessage(data?.error ?? 'This link is invalid or has expired.')
				}
			} catch {
				setState('error')
				setMessage('Something went wrong. Please try again.')
			}
		})()
	}, [token])

	if (state === 'working') {
		return <p className="text-gray-300">Confirming…</p>
	}
	if (state === 'done') {
		return (
			<div className="rounded-2xl border border-green-600/40 bg-green-500/10 p-6">
				<p className="text-green-100 font-semibold mb-1">Deletion confirmed</p>
				<p className="text-gray-300 text-sm leading-relaxed">
					Your account is scheduled for deletion in 14 days. If you change your
					mind, simply sign back in to the app before then and the deletion is
					cancelled automatically.
				</p>
			</div>
		)
	}
	return (
		<div className="rounded-2xl border border-red-600/40 bg-red-500/10 p-6">
			<p className="text-red-100 font-semibold mb-1">We could not confirm</p>
			<p className="text-gray-300 text-sm leading-relaxed">{message}</p>
			<p className="text-gray-400 text-sm mt-3">
				You can start again from the{' '}
				<a href="/delete-account" className="text-blue-400 hover:text-blue-300">
					delete-account page
				</a>
				.
			</p>
		</div>
	)
}
