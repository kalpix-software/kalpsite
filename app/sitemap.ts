import type { MetadataRoute } from 'next'
import { COMPANY } from '@/lib/company'

/**
 * Public routes only. The legal pages are listed deliberately: Google Play
 * reviewers and Indian regulators both look for them, and an indexed policy
 * page is easier to point at than one only reachable from the footer.
 */
const ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
	{ path: '/', priority: 1.0, changeFrequency: 'weekly' },
	{ path: '/about', priority: 0.6, changeFrequency: 'monthly' },
	{ path: '/contact', priority: 0.7, changeFrequency: 'monthly' },
	{ path: '/help', priority: 0.7, changeFrequency: 'monthly' },
	{ path: '/privacy', priority: 0.8, changeFrequency: 'yearly' },
	{ path: '/terms', priority: 0.8, changeFrequency: 'yearly' },
	{ path: '/refund-policy', priority: 0.6, changeFrequency: 'yearly' },
	{ path: '/community-guidelines', priority: 0.6, changeFrequency: 'yearly' },
	{ path: '/child-safety', priority: 0.6, changeFrequency: 'yearly' },
	{ path: '/grievance', priority: 0.7, changeFrequency: 'yearly' },
	{ path: '/delete-account', priority: 0.7, changeFrequency: 'yearly' },
	{ path: '/cookies', priority: 0.5, changeFrequency: 'yearly' },
]

export default function sitemap(): MetadataRoute.Sitemap {
	const lastModified = new Date()
	return ROUTES.map(({ path, priority, changeFrequency }) => ({
		url: `${COMPANY.website}${path === '/' ? '' : path}`,
		lastModified,
		changeFrequency,
		priority,
	}))
}
