import LegalDocument, { Section } from '@/components/LegalDocument'
import { AUTH_COOKIE_NAME, authCookieOptions } from '@/lib/auth-cookie'
import {
	APP,
	COMPANY,
	CONTACTS,
	DATA_PROTECTION_CONTACT,
	POLICY_VERSIONS,
} from '@/lib/company'

/** Cookie lifetime, read from the cookie config so this page cannot drift from it. */
const AUTH_COOKIE_MAX_AGE_DAYS = authCookieOptions.maxAge / (60 * 60 * 24)

const sections: Section[] = [
	{
		heading: 'The short version',
		blocks: [
			{
				kind: 'callout',
				tone: 'info',
				body: `This website sets one cookie, and only if you sign in to the ${COMPANY.shortName} admin area. There are no analytics cookies, no advertising cookies and no third-party tracking cookies on this site. If you are just reading these pages, nothing is stored on your device by us.`,
			},
			{
				kind: 'text',
				body: 'This page lists exactly what is set, what it is for and how long it lasts. We would rather under-describe than over-describe: if something is not on this page, we do not set it.',
			},
		],
	},

	{
		heading: 'The one cookie we set',
		blocks: [
			{
				kind: 'text',
				body: 'The admin area of this site is for our own staff. Signing in there sets a session cookie so the server knows the request is coming from a signed-in administrator. Nothing else on the site sets a cookie.',
			},
			{
				kind: 'table',
				headers: ['Property', 'Value'],
				rows: [
					['Name', AUTH_COOKIE_NAME],
					[
						'Purpose',
						'Keeps an administrator signed in to the admin area. Strictly necessary: without it the admin area cannot work at all.',
					],
					[
						'When it is set',
						'Only on a successful admin sign-in. If two-factor is enabled, it is set only after the code is verified. Never set for ordinary visitors.',
					],
					['Contains', 'A session token issued by our game server. No personal details are stored in the cookie itself.'],
					[
						'Lifetime',
						`Up to ${AUTH_COOKIE_MAX_AGE_DAYS} days, or until you sign out.`,
					],
					[
						'Flags',
						'HttpOnly (JavaScript cannot read it), Secure in production (sent over HTTPS only), SameSite=Strict (never sent from another site).',
					],
					['Who receives it', 'Only this site. It is a first-party cookie and it is not shared with anyone.'],
				],
			},
			{
				kind: 'text',
				body: 'Signing out clears the cookie immediately.',
			},
		],
	},

	{
		heading: 'What we do not set',
		blocks: [
			{
				kind: 'text',
				body: 'To be explicit, this website does not use any of the following:',
			},
			{
				kind: 'list',
				items: [
					'Analytics cookies. There is no Google Analytics, no product analytics tool and no first-party analytics cookie on this site.',
					'Advertising, retargeting or conversion cookies.',
					'Social media pixels or share-button trackers.',
					'A/B testing or personalisation cookies.',
					'Cross-site or cross-device tracking of any kind.',
					'Cookies that profile you or build an advertising audience from your visit.',
				],
			},
			{
				kind: 'text',
				body: 'Because the only cookie we set is strictly necessary for staff sign-in, there is no consent banner on this site. There is nothing to consent to.',
			},
		],
	},

	{
		heading: 'Other storage used by the game pages',
		blocks: [
			{
				kind: 'text',
				body: `Some game screens, currently the Chess lobby and match screens, are web pages served from this site and opened inside the ${APP.name} app. They do not set cookies. They can write two entries to your browser’s per-tab session storage, which is not a cookie, is never sent to a server automatically, and is erased when the tab closes.`,
			},
			{
				kind: 'table',
				headers: ['Key', 'What it holds', 'When it is written'],
				rows: [
					[
						'kalpix.runtimeHost.v1',
						'Which game server the page should talk to.',
						'Only when the page is opened with an explicit host parameter in the URL, which we use for development and testing.',
					],
					[
						'kalpix.devSession.v1',
						'The session token that was handed to the page in the URL, so a page reload does not drop your session.',
						'Only when the page is opened outside the app, in a normal browser. It is never written when the page runs inside the app.',
					],
				],
			},
			{
				kind: 'text',
				body: `The ${APP.name} mobile app itself is not a web browser and does not use cookies. What the app stores about you, and what our servers hold, is described in the Privacy Policy.`,
			},
		],
	},

	{
		heading: 'Third-party content on this site',
		blocks: [
			{
				kind: 'text',
				body: 'We keep this site self-contained on purpose, because embedded third-party content is the usual way tracking cookies arrive on a page without anyone deciding to add them.',
			},
			{
				kind: 'list',
				items: [
					'The typeface used on this site is downloaded when we build the site and served from our own domain, so your browser does not fetch it from a font provider when you visit.',
					'Images are served from our own domain.',
					'There are no embedded videos, no third-party comment widgets, no chat widgets and no tag manager.',
				],
			},
			{
				kind: 'text',
				body: 'Our hosting provider and network provider may keep server logs, including IP addresses, for security and reliability. That is server-side logging, not a cookie, and it is covered by the Privacy Policy.',
			},
		],
	},

	{
		heading: 'If we add advertising',
		blocks: [
			{
				kind: 'text',
				body: `Advertising is planned for ${APP.name} but is not live in the app today, and there is no advertising anywhere on this website.`,
			},
			{
				kind: 'text',
				body: 'If that changes, this page changes first. Ads inside a mobile app normally rely on a device advertising identifier rather than cookies, while ads on a web page normally do use cookies or similar identifiers set by the ad network.',
			},
			{
				kind: 'list',
				items: [
					'We will name the ad or measurement provider on this page before it goes live.',
					'We will describe what it sets, what it is used for and how long it lasts.',
					'We will add a consent control, and ask for consent before setting anything non-essential, wherever the law that applies to you requires it.',
					'We will update the Privacy Policy and the app store data disclosures at the same time.',
				],
			},
		],
	},

	{
		heading: 'Controlling cookies',
		blocks: [
			{
				kind: 'text',
				body: 'Every major browser lets you block cookies or delete the ones already stored, usually under privacy or site settings. You can also clear session storage from the same place.',
			},
			{
				kind: 'text',
				body: 'Blocking cookies for this site has one practical effect: administrators cannot stay signed in to the admin area. Every other page on this site works normally with cookies blocked, because none of them need one.',
			},
		],
	},

	{
		heading: 'Changes and contact',
		blocks: [
			{
				kind: 'text',
				body: 'We update this page whenever what we set changes, and we intend to keep it accurate to the line rather than generic. An inaccurate cookie disclosure is worse than a short one.',
			},
			{
				kind: 'text',
				body: `Questions about this page, or about anything else we store, go to ${DATA_PROTECTION_CONTACT.designation}.`,
			},
			{
				kind: 'contact',
				label: DATA_PROTECTION_CONTACT.designation,
				email: CONTACTS.privacy,
				note: `${DATA_PROTECTION_CONTACT.name}, ${COMPANY.legalName}.`,
			},
		],
	},
]

export default function CookiesPage() {
	return (
		<LegalDocument
			title="Cookie Policy"
			intro={`What this website stores on your device. The honest answer is: almost nothing. This page describes only what ${COMPANY.legalName} actually sets, rather than the usual catch-all list.`}
			sections={sections}
			footnote={`Reviewed alongside our Privacy Policy (version ${POLICY_VERSIONS.privacy.version}, effective ${POLICY_VERSIONS.privacy.effective}). If you find something set on this site that is not described above, tell us at ${CONTACTS.privacy} and we will either remove it or document it.`}
		/>
	)
}
