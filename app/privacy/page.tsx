import LegalDocument, { Section } from '@/components/LegalDocument'
import {
	COMPANY,
	CONTACTS,
	GRIEVANCE_OFFICER,
	DATA_PROTECTION_CONTACT,
	APP,
	POLICY_VERSIONS,
	SLA,
	PROCESSORS,
	DATA_CATEGORIES,
	registeredOfficeInline,
} from '@/lib/company'

const sections: Section[] = [
	{
		heading: 'Who we are',
		blocks: [
			{
				kind: 'text',
				body: `${APP.name} is operated by ${COMPANY.legalName}, a private limited company incorporated in India. When you use ${APP.name}, we decide what personal data is collected and why, so under India's Digital Personal Data Protection Act 2023 we are the Data Fiduciary and you are the Data Principal.`,
			},
			{
				kind: 'list',
				items: [
					`Legal name: ${COMPANY.legalName}`,
					`Corporate Identity Number (CIN): ${COMPANY.cin}`,
					`GSTIN: ${COMPANY.gstin}`,
					`Registered office: ${registeredOfficeInline()}`,
					`Website: ${COMPANY.websiteLabel}`,
					`App: ${APP.name} (${APP.androidPackage} on Android and iOS)`,
				],
			},
			{
				kind: 'text',
				body: 'This notice covers the app and this website. It tells you what we collect, why we hold it, who else sees it, how long we keep it, and what you can do about it. If anything here is unclear, write to us and ask.',
			},
			{
				kind: 'text',
				body: `${COMPANY.legalName} operates ${APP.name} as an intermediary under the Information Technology Act 2000: the messages, photos and posts on the service are created by users, and we host and transmit them. The grievance mechanism that goes with that role is at ${COMPANY.websiteLabel}/grievance and is described in section 14.`,
			},
			{
				kind: 'contact',
				label: 'Data protection contact',
				email: DATA_PROTECTION_CONTACT.email,
				note: `${DATA_PROTECTION_CONTACT.name}, ${DATA_PROTECTION_CONTACT.designation}. This is the mailbox for any question about your personal data, including access, correction, erasure and nomination requests.`,
			},
		],
	},
	{
		heading: 'What we collect, and why',
		blocks: [
			{
				kind: 'text',
				body: 'We collect only what the service needs. Most of it comes from you directly (what you type, upload and choose), some from your device automatically, and some from the sign-in provider you use. The table below is the full list.',
			},
			{
				kind: 'table',
				headers: ['Category', 'What is in it', 'Why we hold it', 'How long we keep it'],
				rows: DATA_CATEGORIES.map((c) => [c.category, c.items, c.why, c.retention]),
			},
			{
				kind: 'text',
				body: `We do not collect your precise location, we do not read your device's photo library beyond the files you pick, and we do not build advertising profiles from your chats. Advertising is not live in the app today. If we introduce it, we will update this notice and tell you before it starts.`,
			},
			{
				kind: 'callout',
				tone: 'info',
				body: `${APP.name} uses virtual coins and gems. Balances and the transaction ledger sit under "Purchases and virtual items" above. Coins and gems have no cash value and cannot be withdrawn or transferred off the platform, so we never hold a bank account or card number for you. Payments are handled entirely by Google Play or Apple.`,
			},
		],
	},
	{
		heading: 'Consent, and how to withdraw it',
		blocks: [
			{
				kind: 'text',
				body: 'We process your personal data on two bases. Most of it we process because you asked us to provide the service and agreed to our Terms when you created your account. A smaller set we process only if you switch it on, and that is consent in the strict sense.',
			},
			{
				kind: 'list',
				items: [
					'Necessary to run your account: your email address and login credentials, your username and profile, your messages and content, your gameplay and purchase records, and the device and log data needed to deliver and secure the service.',
					'Optional, and only with your consent: contact discovery using your phone contacts (section 6 explains where that stands today), push notifications, camera and microphone access for taking photos and recording video, and access to your gallery when you attach a file.',
					'Required by law regardless of consent: keeping tax and accounting records of purchases, and preserving any record we are ordered to preserve by a court, a regulator or the police.',
				],
			},
			{
				kind: 'text',
				body: `You can withdraw consent for anything in the optional list at any time. Device permissions (camera, microphone, photos, notifications) are withdrawn in your phone's own settings for ${APP.name}, and the app keeps working without them, with the matching feature switched off. To withdraw consent for contact discovery, see the contact discovery section below.`,
			},
			{
				kind: 'callout',
				tone: 'warn',
				body: 'Withdrawing consent for the processing that is necessary to run your account is not something we can do while leaving the account open. If you no longer want us to hold your account data at all, the way to withdraw is to delete your account. Section 10 explains how, and what deletion does and does not reach. Withdrawal is not retrospective: it does not undo processing that already, lawfully, happened.',
			},
		],
	},
	{
		heading: 'Who we share your data with',
		blocks: [
			{
				kind: 'text',
				body: 'We do not sell personal data. We do not rent it, and we do not hand it to data brokers. We share it in exactly three situations: with the service providers listed below who run parts of the service for us, with other users where you chose to share it, and with authorities where the law requires it.',
			},
			{
				kind: 'table',
				headers: ['Service', 'What we use it for', 'What data it receives', 'Where it processes'],
				// Only processors that actually receive data today. A service that
				// is configured but not yet wired into the app is listed in
				// company.ts with active:false and stays out of the policy until
				// it goes live, so this table never claims a data flow that does
				// not exist.
				rows: PROCESSORS.filter((p) => p.active).map((p) => [
					p.name,
					p.purpose,
					p.data,
					p.location,
				]),
			},
			{
				kind: 'text',
				body: 'Each of these acts as a Data Processor on our instructions, under a contract, and may not use your data for its own purposes. We add a provider to this table when it is wired into the service, not afterwards.',
			},
			{
				kind: 'text',
				body: 'Other users see what you choose to show them: your username, display name, profile photo, avatar and cosmetics, your level, rating and match results, and any message, post, comment or story you send to them or publish. A message you send to a lounge or a group is visible to everyone in it. Treat anything you post as visible to the people you posted it to, permanently, because they may have already seen or saved it.',
			},
			{
				kind: 'text',
				body: 'We disclose data to law enforcement, courts or regulators when we receive a lawful order, and we may disclose it to protect the safety of a user or the public. We keep a record of such requests.',
			},
		],
	},
	{
		heading: 'Push notifications, and what they carry',
		blocks: [
			{
				kind: 'text',
				body: 'This one is easy to miss, so we are stating it plainly. Push notifications are delivered to your phone by Google Firebase Cloud Messaging. To send you a notification we hand Google a push token identifying your device and the content of the notification itself.',
			},
			{
				kind: 'text',
				body: 'For a chat notification, that content includes the text of the message and, where a message contains an image, video, GIF or sticker, a link to that media. So message text and media links pass through Google infrastructure on their way to your device, even though the message is stored on our own servers.',
			},
			{
				kind: 'list',
				items: [
					`If you turn notifications off for ${APP.name} in your phone settings, we stop sending them and no message content goes to Firebase Cloud Messaging for you.`,
					'Notifications you have already received are held by your device, and any copy already delivered is outside our control.',
					'We do not use push notifications to send you advertising.',
				],
			},
		],
	},
	{
		heading: 'Contact discovery',
		blocks: [
			{
				kind: 'text',
				body: `Contact discovery is the optional feature of the service that tells you which of your phone contacts already use ${APP.name}. The ${APP.name} app does not currently have a screen that uploads your contacts, so in practice we hold no contact list for you. The reverse half of the feature, whether someone who already has your number can find you by it, is on by default; write to us at the address in section 1 if you want that turned off for your account. This section describes how the feature works, because the service supports it.`,
			},
			{
				kind: 'list',
				items: [
					'We never store your contacts as plain phone numbers. Each number is converted on our server into a keyed one-way hash (HMAC-SHA256 with a secret key), and only that hash is written to the database.',
					'The name you saved a contact under is encrypted (AES-256-GCM) before it is stored, so it is not readable in our database.',
					'Matching works by comparing hashes. We cannot recover a phone number from what we store, and we do not message, email or advertise to people in your contacts who do not use the app.',
					'Each sync replaces your previous list entirely, so a contact you delete on your phone disappears from our side on the next sync.',
					`Matching runs in both directions. If you have linked a phone number to your ${APP.name} account, someone who already had your number saved and had contact discovery on can be notified that you have joined. If you would rather that did not happen, do not link a phone number to your account.`,
				],
			},
			{
				kind: 'text',
				body: `To turn contact discovery off and have the contacts we hold for you deleted, email ${CONTACTS.privacy} from your account email address and ask us to disable contact discovery and clear your stored contacts. We will confirm when it is done. Deleting your account removes them too.`,
			},
		],
	},
	{
		heading: 'Decisions made automatically',
		blocks: [
			{
				kind: 'text',
				body: 'Parts of the service act on you by code, with no person involved at the moment it happens. These are the ones worth knowing about.',
			},
			{
				kind: 'list',
				items: [
					'Matchmaking. When you join a game we place you at a table automatically, using the mode you picked and your skill rating.',
					'Skill rating and progression. Your rating is recalculated from your match results by a rating algorithm, and it feeds leaderboards, your visible rank and future matchmaking. Levels and progression are calculated the same way, from what you played.',
					'The word filter in game chat and lounge chat. Messages you send in a match or in a lounge are checked against a blocklist before they are delivered, and a message that matches is rejected and never delivered. There is no appeal step for a rejected message: nothing is recorded against your account, and you can rewrite the message and send it again.',
					'Gameplay refereeing. Turn timers, forfeits and scoring are applied by the server as the rules of the game define them.',
				],
			},
			{
				kind: 'text',
				body: `None of these automated decisions closes your account. If you think an automated decision has got something wrong, write to ${CONTACTS.support} and a person will look at it.`,
			},
		],
	},
	{
		heading: 'Children',
		blocks: [
			{
				kind: 'text',
				body: `${APP.name} is for adults. The minimum age to hold an account is ${APP.minimumAge}. Under the Digital Personal Data Protection Act 2023 anyone under 18 is a child, and because our minimum age is ${APP.minimumAge} we do not offer accounts to children at all and do not process children's data knowingly.`,
			},
			{
				kind: 'list',
				items: [
					`By creating an account you confirm you are at least ${APP.minimumAge}. Our Terms require it, and an account held by someone younger is in breach of them.`,
					'We do not carry out behavioural tracking or targeted advertising directed at children.',
					'If we learn that an account holder is under the minimum age, we act to remove the account and the data held under it.',
				],
			},
			{
				kind: 'contact',
				label: 'Parents and guardians',
				email: CONTACTS.childSafety,
				note: `If you believe someone under ${APP.minimumAge} has created an account, write to this address with the username or email address used. You do not need an account to contact us. A person reads every message sent here, and where we confirm the account holder is under the minimum age we act to remove the account. Child safety reports are treated as urgent.`,
			},
		],
	},
	{
		heading: 'Your rights',
		blocks: [
			{
				kind: 'text',
				body: 'The Digital Personal Data Protection Act 2023 gives you rights over your data. Here is each one, and honestly whether you can exercise it yourself in the app or whether you need to email us.',
			},
			{
				kind: 'table',
				headers: ['Right', 'What it means', 'How you exercise it'],
				rows: [
					[
						'Access',
						'A summary of the personal data we hold about you, what we do with it, and who we have shared it with.',
						`Email ${CONTACTS.privacy} from your account email address. There is no download or export button in the app: we put the summary together by hand and send it to you by email. We aim to reply within ${SLA.supportResponse} and to send the summary itself as quickly as we reasonably can after that.`,
					],
					[
						'Correction',
						'Fixing data about you that is wrong, incomplete or out of date.',
						`In the app for your profile: display name, profile photo, avatar and cosmetics under Edit Profile, and your username through the username change flow. For anything else, email ${CONTACTS.privacy}.`,
					],
					[
						'Erasure',
						'Deleting your personal data when it is no longer needed for the purpose it was collected for.',
						`Delete your account in the app. If you cannot sign in, email ${CONTACTS.privacy} and a person will handle the request once we have confirmed the account is yours. See section 10 for what deletion reaches and what it does not.`,
					],
					[
						'Withdraw consent',
						'Stopping the optional processing you switched on.',
						'Device permissions in your phone settings. Contact discovery by email. See section 3.',
					],
					[
						'Grievance redressal',
						'Complaining about how we handled your data, and getting an answer within a fixed time.',
						`Write to the ${GRIEVANCE_OFFICER.designation} at ${CONTACTS.grievance}. ${COMPANY.websiteLabel}/grievance explains what to include. See section 14.`,
					],
					[
						'Nomination',
						'Naming someone to exercise these rights on your behalf if you die or become unable to act for yourself.',
						`Email ${CONTACTS.privacy} with your account email address and your nominee's name and contact details. There is no in-app screen for this, so nomination is handled entirely by email and we will confirm in writing when it is recorded.`,
					],
				],
			},
			{
				kind: 'text',
				body: `You can also review the devices signed in to your account and sign any of them out from inside the app. To be able to act on a request about an account, we need to know it is yours: we will normally ask you to write from the email address on the account, or to confirm the request from inside the app. This is a safeguard for you, not an obstacle.`,
			},
			{
				kind: 'text',
				body: 'You have a corresponding duty under the Act not to file false or frivolous complaints and not to impersonate someone else when exercising these rights.',
			},
			{
				kind: 'text',
				body: `If you are not satisfied with how we handle a request, you may complain to the Data Protection Board of India. We would rather you came to us first, at ${CONTACTS.grievance}, so we get a chance to fix it.`,
			},
		],
	},
	{
		heading: 'Deleting your account and your data',
		blocks: [
			{
				kind: 'text',
				body: `You can delete your account yourself from inside the app: go to Settings, open Account Management, and choose to delete your account. There is also a route at ${COMPANY.websiteLabel}/delete-account, but it is not the same mechanism: it is an email request that a person at our end verifies and then carries out for you. The in-app route is faster because you are already signed in.`,
			},
			{
				kind: 'list',
				items: [
					`Registered accounts: we confirm it is you, then schedule the deletion. There is a grace period of ${SLA.accountDeletionGrace}. During that window you can cancel simply by logging back in, and the deletion is called off. After it passes, the account is deleted.`,
					'Guest accounts: deleted immediately and permanently, with no grace period. A guest account cannot be recovered, so save anything you want to keep first. A guest account that is left unused is also deleted automatically after 90 days without activity, counted from the last time it was seen on the service.',
				],
			},
			{
				kind: 'text',
				body: 'Deletion removes the account record and everything stored against it: your login credentials and linked sign-in, your sessions and devices, your username, display name, profile photo choice, avatar and cosmetics, your friends and social connections, your coin and gem balances and inventory, your gameplay and rating records, and any contacts held for contact discovery. Coins and gems have no cash value and are not refunded on deletion.',
			},
			{
				kind: 'callout',
				tone: 'warn',
				body: 'Deleting your account removes the messages you sent across direct messages, group chats, lounges and in-match chat, and deletes the photos, videos and voice notes you uploaded from our storage. A few things are kept where the law requires it: purchase and tax records, and safety records of removed content for the period the IT Rules 2021 set. Shared media that has been de-duplicated because other people also sent the identical file is not removed, because it is still theirs too.',
			},
			{
				kind: 'text',
				body: `Deal with both before you delete the account, while you still have the account to do it from. You can delete messages you sent in a direct message, a group or a lounge, and choosing to delete for everyone replaces the message so the other people in that conversation can no longer read it. There is no button that removes a file you have already uploaded, so if you want specific files taken out of storage, email ${CONTACTS.privacy} with enough detail to identify them and ask us to remove them, and do it before the account goes. Once the account is deleted we can no longer identify what was yours.`,
			},
			{
				kind: 'text',
				body: 'Purchase, invoice and tax records also survive deletion, because Indian tax and company law requires us to keep them for the statutory period. These are financial records, not your profile or your messages. Separately, if a court, a regulator or the police has ordered us to preserve specific records, we keep those for as long as that order requires.',
			},
			{
				kind: 'text',
				body: `Our databases and storage are backed up, so deleted data can persist in a backup until that backup is replaced in the normal course. If you want written confirmation once your deletion has completed, ask at ${CONTACTS.privacy}.`,
			},
		],
	},
	{
		heading: 'How we protect your data',
		blocks: [
			{
				kind: 'text',
				body: 'We take reasonable security safeguards to prevent a personal data breach, as the Act requires. In honest terms, here is what that means in practice rather than as a slogan.',
			},
			{
				kind: 'list',
				items: [
					'Your password is stored as a bcrypt hash, which is one-way: we cannot read it back or tell you what it is.',
					'There is one exception, and we would rather state it than let the sentence above imply more than it should. When a guest account is upgraded to a full account with an email address, the password you choose is held in readable form in a separate table until you enter the one-time code we email you. Once the code is verified the readable copy is deleted and only the hash remains, and if you never finish the upgrade the copy is cleared by a cleanup job. One-time codes themselves are stored in readable form for the few minutes they are valid.',
					'Traffic between the app and our servers travels over HTTPS/TLS.',
					'Phone numbers used for contact discovery are stored only as keyed hashes, and contact labels are encrypted at rest.',
					'You can list the devices signed in to your account and revoke any session from the app, which is the fastest way to cut off access if you lose a phone.',
					'Access to production systems is limited to the people who need it to operate the service.',
					'Our servers, databases and object storage are run on the providers named in section 4, on their managed infrastructure.',
				],
			},
			{
				kind: 'text',
				body: 'No system is perfectly secure, and we will not pretend otherwise. If a breach affects your personal data we will notify you and the Data Protection Board of India as the Act requires. If you think you have found a security problem, tell us before you tell anyone else and we will work with you on it.',
			},
			{
				kind: 'contact',
				label: 'Report a security issue',
				email: CONTACTS.security,
				note: 'Please include enough detail for us to reproduce the issue. We do not take legal action against people who report vulnerabilities to us in good faith and give us a reasonable chance to fix them.',
			},
		],
	},
	{
		heading: 'Transfers outside India',
		blocks: [
			{
				kind: 'text',
				body: 'Some of the providers in section 4 process data outside India. Google, Giphy and Resend operate in the United States, and Cloudflare serves media from a global edge network. Our own application servers and databases are hosted in India and the Asia-Pacific region.',
			},
			{
				kind: 'text',
				body: 'The Digital Personal Data Protection Act 2023 permits transfers outside India except to countries the Central Government restricts by notification. We do not transfer personal data to any country that is currently restricted, and if a restriction is notified that affects a provider we use, we will move that processing or stop using the provider.',
			},
			{
				kind: 'text',
				body: 'Every provider we transfer data to is bound by a contract limiting what it may do with the data. Transferring data abroad does not change your rights under this notice or reduce our responsibility for it.',
			},
		],
	},
	{
		heading: 'Changes to this notice',
		blocks: [
			{
				kind: 'text',
				body: `This is version ${POLICY_VERSIONS.privacy.version}, effective ${POLICY_VERSIONS.privacy.effective}. When we change it we bump the version and the effective date together, and the previous version stops applying from that date.`,
			},
			{
				kind: 'list',
				items: [
					'For a substantive change (a new category of data, a new processor, a new purpose) we notify you in the app and ask you to accept the new version before you continue.',
					'For a minor correction we update the page and the version stamp without interrupting you.',
					'Either way, we notify you of the current version of this notice and our Terms at least once a year, as the IT Rules 2021 require.',
				],
			},
			{
				kind: 'text',
				body: `Related documents: our Terms of Service at ${COMPANY.websiteLabel}/terms, and how this website uses cookies at ${COMPANY.websiteLabel}/cookies.`,
			},
		],
	},
	{
		heading: 'Grievance redressal',
		blocks: [
			{
				kind: 'text',
				body: `If you have a complaint about your personal data, about content, or about how we have treated you, our ${GRIEVANCE_OFFICER.designation} is responsible for answering it. This is a statutory role under the IT Rules 2021 and it carries a fixed clock.`,
			},
			{
				kind: 'list',
				items: [
					`We acknowledge your complaint within ${SLA.grievanceAcknowledgement}.`,
					`We resolve it within ${SLA.grievanceResolution}, and tell you what we decided and why.`,
					`Content that is unlawful under a valid government or court order is removed within ${SLA.unlawfulContentOrder}.`,
					`Reports of non-consensual intimate imagery or impersonation of that kind are actioned within ${SLA.intimateImageryTakedown}.`,
				],
			},
			{
				kind: 'text',
				body: `Write to the ${GRIEVANCE_OFFICER.designation} at ${CONTACTS.grievance}, or by post at the registered office: ${registeredOfficeInline()}. The page at ${COMPANY.websiteLabel}/grievance sets out what to include and the timelines we work to. There is no online form: a complaint is an email that a person reads.`,
			},
			{
				kind: 'contact',
				label: `${GRIEVANCE_OFFICER.designation}: ${GRIEVANCE_OFFICER.name}`,
				email: GRIEVANCE_OFFICER.email,
				note: `Please include your username, the date, and what you would like us to do. If your complaint is specifically about personal data, ${CONTACTS.privacy} reaches the data protection contact directly and may be faster.`,
			},
		],
	},
]

export default function PrivacyPage() {
	return (
		<LegalDocument
			title="Privacy Policy"
			intro={`How ${COMPANY.legalName} collects, uses, shares and protects your personal data when you use ${APP.name}. Written to be read, not to be skimmed past. If you only read two sections, read section 5 on push notifications and section 10 on deleting your account, which sets out what deletion does not reach.`}
			version={POLICY_VERSIONS.privacy.version}
			effective={POLICY_VERSIONS.privacy.effective}
			sections={sections}
			footnote={`${COMPANY.legalName}, ${registeredOfficeInline()}. For anything in this notice, write to ${CONTACTS.privacy}. For a formal complaint, use ${COMPANY.websiteLabel}/grievance.`}
		/>
	)
}
