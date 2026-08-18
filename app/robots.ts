import type { MetadataRoute } from 'next'
import { COMPANY } from '@/lib/company'

/**
 * Keep the admin dashboard, the in-app webview game routes and the personal
 * share links out of search results. The share routes (/i, /p, /r) resolve to
 * individual users' invites and profiles, so indexing them would publish
 * personal data that was only ever meant to be shared one-to-one.
 */
export default function robots(): MetadataRoute.Robots {
	return {
		rules: [
			{
				userAgent: '*',
				allow: '/',
				disallow: ['/admin', '/admin/', '/api/', '/games/chess/', '/i/', '/p/', '/r/'],
			},
		],
		sitemap: `${COMPANY.website}/sitemap.xml`,
		host: COMPANY.website,
	}
}
