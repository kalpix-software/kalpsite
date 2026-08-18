import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import PublicPageLayout from '@/components/PublicPageLayout'
import FadeIn from '@/components/FadeIn'
import { pendingDisclosures } from '@/lib/company'

/**
 * Shared renderer for every legal / policy page on the site.
 *
 * All of them share one structure — title, version stamp, intro, then numbered
 * sections built from a small set of blocks — so that the pages stay consistent
 * with each other and a new policy is a data file rather than a new layout.
 */

export type Block =
	| { kind: 'text'; body: string }
	| { kind: 'list'; items: string[]; ordered?: boolean }
	| { kind: 'table'; headers: string[]; rows: string[][] }
	| { kind: 'callout'; tone?: 'info' | 'warn'; body: string }
	| { kind: 'contact'; label: string; email: string; note?: string }

export type Section = {
	heading: string
	blocks: Block[]
}

export type LegalDocumentProps = {
	title: string
	intro: string
	version?: string
	effective?: string
	sections: Section[]
	/** Rendered under the last section, before the back link. */
	footnote?: string
	/** Interactive content (e.g. a form) rendered after the intro, before the
	 * sections. Lets a mostly-static legal page host a client component without
	 * the whole page becoming a client component. */
	children?: React.ReactNode
}

function BlockView({ block }: { block: Block }) {
	switch (block.kind) {
		case 'text':
			return <p className="text-gray-300 leading-relaxed">{block.body}</p>

		case 'list': {
			const cls = 'text-gray-300 leading-relaxed space-y-2 pl-5'
			return block.ordered ? (
				<ol className={`${cls} list-decimal marker:text-blue-400`}>
					{block.items.map((item, i) => (
						<li key={i}>{item}</li>
					))}
				</ol>
			) : (
				<ul className={`${cls} list-disc marker:text-blue-400`}>
					{block.items.map((item, i) => (
						<li key={i}>{item}</li>
					))}
				</ul>
			)
		}

		case 'table':
			return (
				<div className="overflow-x-auto -mx-2 px-2">
					<table className="w-full min-w-[34rem] text-left text-sm border-collapse">
						<thead>
							<tr className="border-b border-slate-600">
								{block.headers.map((h, i) => (
									<th
										key={i}
										scope="col"
										className="py-2 pr-4 font-semibold text-white align-bottom"
									>
										{h}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{block.rows.map((row, i) => (
								<tr key={i} className="border-b border-slate-700/60 align-top">
									{row.map((cell, j) => (
										<td key={j} className="py-3 pr-4 text-gray-300">
											{cell}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)

		case 'callout':
			return (
				<div
					className={`rounded-xl border p-4 text-sm leading-relaxed ${
						block.tone === 'warn'
							? 'border-amber-500/40 bg-amber-500/10 text-amber-100'
							: 'border-blue-500/40 bg-blue-500/10 text-blue-100'
					}`}
				>
					{block.body}
				</div>
			)

		case 'contact':
			return (
				<div className="rounded-xl border border-slate-600 bg-slate-900/40 p-4">
					<p className="text-sm uppercase tracking-wide text-gray-400 mb-1">
						{block.label}
					</p>
					<a
						href={`mailto:${block.email}`}
						className="text-blue-400 hover:text-blue-300 transition-colors break-all"
					>
						{block.email}
					</a>
					{block.note ? (
						<p className="text-gray-400 text-sm mt-2">{block.note}</p>
					) : null}
				</div>
			)
	}
}

export default function LegalDocument({
	title,
	intro,
	version,
	effective,
	sections,
	footnote,
	children,
}: LegalDocumentProps) {
	const pending = pendingDisclosures()

	return (
		<PublicPageLayout>
			<div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
				<FadeIn>
					<h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
						{title}
					</h1>

					{(version || effective) && (
						<p className="text-gray-400 mb-2 text-sm">
							{version ? `Version ${version}` : null}
							{version && effective ? ' · ' : null}
							{effective ? `Effective ${effective}` : null}
						</p>
					)}

					<p className="text-gray-400 mb-10 leading-relaxed">{intro}</p>

					{children ? <div className="mb-10">{children}</div> : null}

					{pending.length > 0 && (
						<div className="mb-10 rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 flex gap-3">
							<AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
							<div className="text-sm text-amber-100">
								<p className="font-semibold mb-1">
									This page is not ready to publish.
								</p>
								<p>
									These statutory disclosures are still placeholders:{' '}
									{pending.join(', ')}. Fill them in{' '}
									<code className="text-amber-200">lib/company.ts</code> before
									the site goes live.
								</p>
							</div>
						</div>
					)}

					<div className="space-y-8">
						{sections.map((section, i) => (
							<section
								key={i}
								className="rounded-2xl bg-slate-800/50 border border-slate-700 p-6 md:p-8"
							>
								<h2 className="text-xl font-semibold text-white mb-4">
									{i + 1}. {section.heading}
								</h2>
								<div className="space-y-4">
									{section.blocks.map((block, j) => (
										<BlockView key={j} block={block} />
									))}
								</div>
							</section>
						))}
					</div>

					{footnote ? (
						<p className="text-gray-500 text-sm mt-8 leading-relaxed">
							{footnote}
						</p>
					) : null}

					<div className="mt-12 text-center">
						<Link
							href="/"
							className="text-blue-400 hover:text-blue-300 transition-colors"
						>
							← Back to home
						</Link>
					</div>
				</FadeIn>
			</div>
		</PublicPageLayout>
	)
}
