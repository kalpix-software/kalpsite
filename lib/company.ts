/**
 * Single source of truth for every legally-significant fact published on this site.
 *
 * The legal pages (privacy, terms, refunds, grievance, community guidelines,
 * child safety, delete-account, contact, about, help) all read from here, so a
 * change to the entity details, the Grievance Officer or a policy version
 * propagates everywhere at once.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️  ITEMS MARKED `TODO_` ARE PLACEHOLDERS AND MUST BE FILLED BEFORE LAUNCH.
 *
 * They are statutory disclosures — publishing the site with the placeholder
 * strings still in place is worse than not publishing the page at all, because
 * an incorrect disclosure is itself a violation. `pendingDisclosures()` below
 * lists whatever is still unset so a pre-deploy check can fail on it.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const COMPANY = {
	/** Exact legal name as registered with the MCA. Must match the D-U-N-S record. */
	legalName: 'Kalpix Software Private Limited',
	shortName: 'Kalpix',

	/** Corporate Identity Number from the Certificate of Incorporation. */
	cin: 'U62011UP2025PTC237534',
	/** GST Identification Number. Required by the e-commerce rules and by Google Play's payments profile. */
	gstin: '09AAMCK3704E1ZL',

	website: 'https://kalpixsoftware.com',
	websiteLabel: 'kalpixsoftware.com',

	registeredOffice: {
		lines: [
			'C/O Sukkhoo Prasad',
			'O Vill PO, Sunderpur',
			'Khojwa Bazar, Varanasi',
			'Varanasi — 221010',
			'Uttar Pradesh, India',
		],
		country: 'India',
	},

	/** Customer-care telephone. Mandatory under the Consumer Protection (E-Commerce) Rules 2020. */
	phone: '+91 6386965217',
} as const

/**
 * One mailbox per purpose. Keep them distinct: the grievance mailbox carries a
 * statutory response clock and should not be buried in general support volume.
 */
export const CONTACTS = {
	general: 'contact@kalpixsoftware.com',
	support: 'contact@kalpixsoftware.com',//support@kalpixsoftware.com
	privacy: 'contact@kalpixsoftware.com',//support@kalpixsoftware.com
	grievance: 'contact@kalpixsoftware.com',//privacy@kalpixsoftware.com
	legal: 'contact@kalpixsoftware.com',//legal@kalpixsoftware.com
	security: 'contact@kalpixsoftware.com',//security@kalpixsoftware.com
	childSafety: 'contact@kalpixsoftware.com',//childsafety@kalpixsoftware.com
} as const

/**
 * External child-protection resources referenced by the Child Safety Standards
 * page. These are public Government of India services, not services we operate.
 */
export const CHILD_SAFETY_RESOURCES = {
	helpline: {
		label: 'national child helpline',
		number: '1098',
	},
	cybercrimePortal: {
		name: 'National Cyber Crime Reporting Portal',
		domain: 'cybercrime.gov.in',
		url: 'https://cybercrime.gov.in',
	},
} as const

/**
 * Grievance Appellate Committee, constituted by the Central Government under
 * Rule 3A of the IT Rules 2021. A user who is unhappy with a decision of our
 * Grievance Officer appeals to the Committee on its own portal; it is not a
 * service we operate and we have no role in the appeal.
 */
export const GRIEVANCE_APPELLATE = {
	name: 'Grievance Appellate Committee',
	domain: 'gac.gov.in',
	url: 'https://gac.gov.in',
	/** Rule 3A(3): appeal within thirty days of receiving the officer's decision. */
	appealWindow: 'thirty days',
} as const

/**
 * Grievance Officer — IT (Intermediary Guidelines and Digital Media Ethics Code)
 * Rules, 2021, Rule 3(2)(a). The name, designation and contact details must be
 * published prominently on the site and inside the app. Must be an employee
 * resident in India.
 */
export const GRIEVANCE_OFFICER = {
	name: 'Dayanidhi Gupta',
	designation: 'Director & Grievance Officer',
	email: CONTACTS.grievance,
	/** Postal address for service. Defaults to the registered office. */
	addressLines: COMPANY.registeredOffice.lines,
} as const

/**
 * Contact for data-protection questions under the DPDP Act 2023. A Significant
 * Data Fiduciary must appoint a DPO; everyone else must at minimum publish the
 * contact details of the person answering data-principal questions.
 */
export const DATA_PROTECTION_CONTACT = {
	name: 'Dayanidhi Gupta',
	designation: 'Data Protection Contact',
	email: CONTACTS.privacy,
} as const

/** The app itself. */
export const APP = {
	name: 'Plak',
	tagline: 'Play together. Chat together.',
	androidPackage: 'com.kalpixsoftware.plak',
	iosBundleId: 'com.kalpixsoftware.plak',
	/** Host registered for Android App Links / Universal Links. */
	deepLinkHost: 'plak.kalpixsoftware.com',
	/** Minimum age to hold an account. Under the DPDP Act 2023 a "child" is anyone under 18. */
	minimumAge: 18,
} as const

/**
 * Policy versions. Bump the version AND the effective date together whenever the
 * substance changes; the app forces re-acceptance on a version change, and
 * IT Rules 2021 Rule 3(1)(f) requires users to be notified at least annually.
 */
export const POLICY_VERSIONS = {
	privacy: { version: '2.1', effective: '2026-08-23' },
	terms: { version: '2.1', effective: '2026-08-23' },
	community: { version: '1.0', effective: '2026-08-15' },
	refunds: { version: '1.0', effective: '2026-08-15' },
	childSafety: { version: '1.1', effective: '2026-08-23' },
} as const

/** Statutory response clocks, published so users can hold us to them. */
export const SLA = {
	grievanceAcknowledgement: '24 hours',
	grievanceResolution: '15 days',
	unlawfulContentOrder: '36 hours',
	intimateImageryTakedown: '24 hours',
	informationRequest: '72 hours',
	accountDeletionGrace: '14 days',
	supportResponse: '1–2 business days',
} as const

/**
 * Every third party that receives personal data, and what for. The privacy
 * policy renders this list directly — add a processor here the moment it is
 * wired into the backend, never afterwards.
 */
export const PROCESSORS = [
	{
		name: 'Google Firebase (Authentication)',
		purpose: 'Signing you in with Google, and verifying your phone number if you link one.',
		data: 'Email address, Google account identifier, phone number, device identifiers.',
		location: 'United States and other Google regions',
		active: true,
	},
	{
		name: 'Google Firebase Cloud Messaging',
		purpose: 'Delivering push notifications to your device.',
		data: 'Device push token, and the notification content itself — which for a chat notification includes the message text and any media link.',
		location: 'United States and other Google regions',
		active: true,
	},
	{
		name: 'Cloudflare R2',
		purpose: 'Storing and serving the images, videos and avatars you upload.',
		data: 'Uploaded media files and their metadata.',
		location: 'Global edge network',
		active: true,
	},
	{
		// Kept as a record rather than deleted, so that wiring S3 back up is a
		// one-line change here and cannot be done without restoring the
		// disclosure. active:false removes it from the published table.
		//
		// Not live: PROFILE_IMAGE_STORAGE is r2 on every environment and the
		// AWS_* credentials are unset on both droplets, so no file reaches S3.
		// Naming a recipient we do not actually send data to is still an
		// inaccurate disclosure, even though it errs generously.
		name: 'Amazon Web Services (S3)',
		purpose: 'Storing and serving uploaded files. Not in use — Cloudflare R2 is the storage backend on every environment.',
		data: 'Uploaded media files and their metadata.',
		location: 'India / Asia-Pacific regions',
		active: false,
	},
	{
		name: 'DigitalOcean',
		purpose: 'Hosting our application servers and databases.',
		data: 'All account and gameplay data processed by the service.',
		location: 'India / Asia-Pacific regions',
		active: true,
	},
	{
		name: 'Giphy',
		purpose: 'GIF search inside chat. Results are limited to Giphy’s “G” rating.',
		data: 'Your search term, sent from your device directly to Giphy. Because the request comes from your device, Giphy also receives your IP address. We do not send them your name or account details.',
		location: 'United States',
		active: true,
	},
	{
		name: 'Google Play Billing',
		purpose: 'Processing in-app purchases on Android and validating receipts.',
		data: 'Purchase tokens and transaction identifiers. We never receive your card details.',
		location: 'Global',
		active: true,
	},
	{
		name: 'Apple App Store',
		purpose: 'Processing in-app purchases on iOS and validating receipts.',
		data: 'Purchase receipts. We never receive your card details.',
		location: 'Global',
		active: true,
	},
	{
		name: 'Resend',
		purpose: 'Sending transactional email such as sign-in verification codes and welcome messages.',
		data: 'Email address and message content.',
		location: 'United States',
		active: true,
	},
	{
		// NOT LIVE. The Firebase project has Analytics enabled, but no analytics
		// SDK ships in the app, so nothing is collected and this row is hidden
		// from the privacy policy by the `active` flag.
		//
		// To switch it on, all four must happen together, or the published
		// policy stops matching the product:
		//   1. add `firebase_analytics` to plak/pubspec.yaml
		//   2. set active: true here
		//   3. declare "App interactions" and "App info and performance" in the
		//      Play Data safety form
		//   4. declare the Advertising ID and add the AD_ID permission to the
		//      Android manifest, if the SDK pulls it in
		name: 'Google Analytics for Firebase',
		purpose: 'Understanding how the app is used: retention, which screens people reach, and where they drop out.',
		data: 'A per-install app instance identifier, device model, operating system, app version, and the in-app events you trigger. On Android this may include the Advertising ID.',
		location: 'United States and other Google regions',
		active: false,
	},
] as const

/**
 * Categories of personal data we hold. This must stay consistent with the
 * Google Play Data safety declaration — a mismatch between the two is a common
 * cause of review rejection.
 */
export const DATA_CATEGORIES = [
	{
		category: 'Account and identity',
		items:
			'Email address, username, display name, profile photo, avatar selection, the gender you pick when choosing your starting avatar, country, and your phone number if you choose to link one.',
		why:
			'To create and secure your account, and to let people find and recognise you. The gender you pick is used for one thing only — deciding which avatar your account starts with. You can change that avatar whenever you like, and we do not use the answer for advertising, pricing, matchmaking or anything else.',
		retention: 'For as long as your account exists.',
	},
	{
		category: 'Age',
		items:
			'The age you enter on the first screen when you open the app, and the date you entered it. If you have separately given us an actual date of birth, that as well — we never turn an age into a date of birth, so this is empty unless you were asked for one.',
		why:
			'Under the Digital Personal Data Protection Act 2023 anyone under 18 is a child, and creating an account is itself processing, so we have to establish age before an account exists rather than afterwards. It is also what we check before a purchase or anything else age-restricted.',
		retention:
			'For as long as your account exists. The answer is recorded once and re-entering it does not change it, so being turned away cannot be retried by answering differently.',
	},
	{
		category: 'Authentication and security',
		items: 'Password (stored hashed), Google sign-in identifier, one-time verification codes, session and device records, login timestamps.',
		why: 'To sign you in, keep your account secure, and let you review and revoke your active sessions.',
		retention: 'For the life of the account; session records rotate continuously.',
	},
	{
		category: 'Content you create',
		items: 'Chat messages, group and lounge messages, in-match chat, and the photos, videos, GIFs and stickers you send.',
		why: 'To deliver your messages and content to the people you send them to.',
		retention:
			'Until you delete it, or until your account is deleted. Deleting your account removes the messages you sent and the photos, videos and voice notes you uploaded.',
	},
	{
		category: 'Contacts',
		items: 'Hashed phone-number contacts, if you choose to enable contact discovery.',
		why: 'To show you which of your contacts already use the app. Stored in encrypted form; entirely optional.',
		retention: 'Until you disable contact discovery or delete your account.',
	},
	{
		category: 'Purchases and virtual items',
		items: 'Purchase history, store orders, in-app purchase receipts, coin and gem balances, and the transaction ledger.',
		why: 'To deliver what you bought, support refunds, and meet tax and accounting obligations.',
		retention: 'Retained after account deletion where tax and accounting law requires it.',
	},
	{
		category: 'Gameplay',
		items: 'Match history, results, skill rating, levels, achievements, daily rewards.',
		why: 'To run matchmaking, leaderboards and progression.',
		retention: 'Recent match history only; older records are aggregated or removed.',
	},
	{
		category: 'Device and technical',
		items: 'Device model and operating system, app version, device identifiers, push tokens, IP address, and diagnostic logs.',
		why: 'To deliver the service, prevent abuse and fix faults.',
		retention: 'Logs are retained for a limited period and then deleted.',
	},
	{
		category: 'Safety and moderation',
		items: 'Reports you file or that are filed about you, and the outcome recorded against them.',
		why: 'To keep the platform safe and to answer complaints and lawful requests.',
		retention:
			'Reports about a message in a lounge or in a match are kept indefinitely. Reports about a direct or group message are removed if either account involved is deleted.',
	},
] as const

/** Returns the placeholder keys still unfilled. Wire into a pre-deploy check. */
export function pendingDisclosures(): string[] {
	const pending: string[] = []
	const check = (label: string, value: string) => {
		if (value.startsWith('TODO_')) pending.push(label)
	}
	check('Company CIN', COMPANY.cin)
	check('Company GSTIN', COMPANY.gstin)
	check('Customer-care phone', COMPANY.phone)
	check('Grievance Officer name', GRIEVANCE_OFFICER.name)
	check('Data protection contact name', DATA_PROTECTION_CONTACT.name)
	return pending
}

/** True when every statutory disclosure has a real value. */
export const disclosuresComplete = () => pendingDisclosures().length === 0

/** Formats the registered office as a single line for inline use. */
export const registeredOfficeInline = () =>
	COMPANY.registeredOffice.lines.join(', ')
