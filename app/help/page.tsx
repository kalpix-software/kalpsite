import LegalDocument, { Section } from '@/components/LegalDocument'
import { APP, COMPANY, CONTACTS, SLA } from '@/lib/company'

const sections: Section[] = [
	{
		heading: 'Getting started, and the two kinds of account',
		blocks: [
			{
				kind: 'text',
				body: `You can start playing ${APP.name} as a guest, without giving us an email address. A guest account is quick, but it is temporary and it is tied to the device you created it on.`,
			},
			{
				kind: 'table',
				headers: ['', 'Guest account', 'Registered account'],
				rows: [
					['Play games and chat', 'Yes', 'Yes'],
					['Survives reinstalling the app or changing phone', 'No', 'Yes'],
					[
						'Removed on its own',
						'Yes, 90 days after it was last used',
						'No',
					],
					['Can be recovered if you lose access', 'No', 'Yes, by signing in again'],
					['Coins, gems and purchases are safe', 'No, they go when the guest account goes', 'Yes'],
				],
			},
			{
				kind: 'callout',
				tone: 'warn',
				body: 'A guest account is removed once it has gone 90 days without being used, counted from the last time you were seen playing, or from the day it was created if it was never used. If you have spent money or built up progress as a guest, link an email address or a Google account now. Once a guest account is removed or the device is gone, we cannot get it back for you, because there is nothing tying it to you.',
			},
			{
				kind: 'text',
				body: `You must be at least ${APP.minimumAge} to hold an account of any kind.`,
			},
		],
	},
	{
		heading: 'Signing in',
		blocks: [
			{
				kind: 'text',
				body: 'There are three ways in: email and password, Google sign-in, or a guest account.',
			},
			{
				kind: 'text',
				body: 'When you register with an email address, or link an email to a guest account, we send a six digit verification code to that address.',
			},
			{
				kind: 'list',
				items: [
					'The code is valid for 5 minutes. After that, ask for a new one.',
					'You get 5 tries per code. Too many wrong entries and you will need a fresh code.',
					'Requests for new codes are rate limited, so if you tap resend repeatedly you may be asked to wait.',
				],
			},
			{
				kind: 'text',
				body: 'If the code does not arrive: check your spam or promotions folder, confirm the address you typed has no typo, wait a minute (mail is not always instant), then request one resend. If nothing has arrived after several minutes, email us from the address you were trying to register and we will verify you manually.',
			},
			{
				kind: 'contact',
				label: 'Sign-in problems',
				email: CONTACTS.support,
				note: 'Tell us the email address you used and roughly when you tried. Never send us your password.',
			},
		],
	},
	{
		heading: 'Changing your username',
		blocks: [
			{
				kind: 'text',
				body: 'You can change your username from your profile. Your first change after signing up is always allowed. After that there is a 90 day cooldown before you can change it again, so pick something you are happy with.',
			},
			{
				kind: 'text',
				body: 'Your display name is separate and is not subject to the cooldown. Usernames have to be unique, so if the one you want is refused, someone already has it.',
			},
		],
	},
	{
		heading: 'Coins and gems',
		blocks: [
			{
				kind: 'text',
				body: 'Coins and gems are virtual items inside the app. You earn them by playing: daily login rewards and gameplay both pay out. Buying them with real money runs through Google Play Billing or the Apple App Store; if the buy button tells you purchases are not available yet, that feature has not been switched on in your version of the app.',
			},
			{
				kind: 'text',
				body: 'You spend them in the store on cosmetics (avatars, card decks, table backgrounds, chat themes). Store items are priced in coins or in gems depending on the item.',
			},
			{
				kind: 'callout',
				tone: 'warn',
				body: 'Coins and gems have no cash value. They cannot be withdrawn, cashed out, converted back into money, sold, or transferred to another person or platform. Coins only ever get you more play inside the app, nothing else.',
			},
		],
	},
	{
		heading: 'Are the games free?',
		blocks: [
			{
				kind: 'text',
				body: `Yes. Every game in ${APP.name}, Tero and Chess, is free to play. There is no entry fee, no stake and no prize — you never spend or risk coins to play a match. Coins and gems are only for cosmetics and progression in the store.`,
			},
			{
				kind: 'text',
				body: 'If your connection drops mid-match, the match keeps running and your seat is held for a short while. Reopen the app and take the "game in progress" prompt to rejoin. If you do not come back in time, or you leave deliberately, you place last and the match continues for the other players.',
			},
		],
	},
	{
		heading: 'A purchase did not arrive',
		blocks: [
			{
				kind: 'text',
				body: 'First, close the app fully and reopen it. Most delayed purchases land on the next sign-in, because the receipt is confirmed with Google or Apple when the app reconnects.',
			},
			{
				kind: 'text',
				body: 'If it is still missing, email support with as much of the following as you have. The order identifier is the one thing we really need: without it we cannot find your transaction.',
			},
			{
				kind: 'list',
				items: [
					'The Google Play order ID (it looks like GPA.xxxx-xxxx-xxxx-xxxxx) or the Apple receipt or transaction ID from your purchase confirmation email.',
					'The email address on your app account, and your username.',
					'What you bought, and the amount and currency you were charged.',
					'The date and approximate time of the purchase.',
					'A screenshot of the charge from Google Play or the App Store, if you have one.',
				],
			},
			{
				kind: 'text',
				body: 'The store, not us, takes the payment and issues refunds of money. We can credit what you paid for, or tell you what we see on our side. See our refunds policy for what is and is not refundable.',
			},
			{
				kind: 'contact',
				label: 'Purchase problems',
				email: CONTACTS.support,
			},
		],
	},
	{
		heading: 'Reporting someone, and blocking',
		blocks: [
			{
				kind: 'text',
				body: 'If somebody is being abusive, you have two tools and they do different jobs.',
			},
			{
				kind: 'list',
				items: [
					'Report: you can report an individual message, or report the person from their profile. Reporting a direct message, a group message or a person reaches our review queue with what you reported and the reason you gave. Reporting a lounge or in-match message records it, but for anything urgent there, report the person from their profile as well. Use this when a rule has been broken. The other person is not told that you reported them.',
					'Block: from their profile. Blocking cuts the link between you: any friend or follow connection is removed, pending follow requests are cancelled, and messages they send you are silently dropped, so they are not told they have been blocked. You can unblock later from the same place.',
				],
			},
			{
				kind: 'text',
				body: 'Match chat and lounge chat run through a profanity filter, but a filter is not a substitute for a report. If you saw something a filter cannot catch (harassment, a scam, threats), report it.',
			},
			{
				kind: 'callout',
				tone: 'warn',
				body: 'Anything involving a child, or sexual content involving a minor, does not go through normal support. Use the child safety page below and we will treat it as urgent.',
			},
		],
	},
	{
		heading: 'Groups, lounges and chat you want to leave',
		blocks: [
			{
				kind: 'list',
				items: [
					'Mute: open a chat or a group and mute it. You stay in it and can still read it, but it stops sending you notifications. This is usually what you actually want. Lounges do not send notifications, so there is nothing to mute there.',
					'Leave a group: from the group details screen. You stop receiving its messages. In a group you did not create, leaving is final unless someone adds you back.',
					'Lounges are public rooms and their chat is temporary, so leaving one is not a big decision. You can walk back in.',
					'Block, described above, is the right tool for one specific person rather than a whole room.',
				],
			},
		],
	},
	{
		heading: 'Notifications are not arriving',
		blocks: [
			{
				kind: 'text',
				body: 'Push notifications reach you through Google Firebase Cloud Messaging. When they stop, it is almost always one of these, in this order:',
			},
			{
				kind: 'list',
				ordered: true,
				items: [
					'Notification permission for the app is off in your phone settings. On Android and iOS this is a per-app switch.',
					'The specific chat or group is muted inside the app.',
					'Battery optimisation or a power-saving mode is stopping the app from being woken in the background. This is the most common cause on Android, and the setting is usually called battery optimisation, app standby, or something similar depending on the manufacturer.',
					'You are signed in to the same account on another device that is taking the notification.',
					'Do Not Disturb or a focus mode is on.',
				],
			},
			{
				kind: 'text',
				body: 'If all of those are ruled out, sign out and back in once. That reissues the push token for your device, which fixes a stale token. Still nothing? Email support and tell us the phone model and OS version, and we will look at whether the token is registering on our side.',
			},
		],
	},
	{
		heading: 'Deleting your account',
		blocks: [
			{
				kind: 'text',
				body: 'You can delete your account from inside the app, in your account settings. You do not have to email anyone to do it.',
			},
			{
				kind: 'list',
				items: [
					`Registered accounts: deletion starts a grace period of ${SLA.accountDeletionGrace}. During that window you are signed out, but if you change your mind you just sign back in with the same credentials and the deletion is cancelled, with everything intact. After the window closes, it is permanent.`,
					'Guest accounts: deleted immediately. There is no grace period and no way back, because there are no credentials to sign back in with.',
				],
			},
			{
				kind: 'callout',
				tone: 'warn',
				body: 'Deleting your account does not refund purchases and does not return the value of coins or gems. Spend or use anything you care about first. Some records, such as purchase and tax records, are kept after deletion where the law requires it. The privacy policy sets out exactly what is kept and for how long.',
			},
		],
	},
	{
		heading: 'Reaching a human',
		blocks: [
			{
				kind: 'text',
				body: `Email is the fastest route and it reaches a person, not a bot. We aim to respond within ${SLA.supportResponse}.`,
			},
			{
				kind: 'contact',
				label: 'Support',
				email: CONTACTS.support,
				note: 'Include your username and, if it is about a purchase, the order ID. It saves a round trip.',
			},
			{
				kind: 'contact',
				label: 'Privacy and your data',
				email: CONTACTS.privacy,
				note: 'Access, correction or erasure of your personal data, and any question about how we handle it.',
			},
			{
				kind: 'text',
				body: 'Please do not send us your password, a one-time code, or your card details. We will never ask for any of them.',
			},
		],
	},
	{
		heading: 'If support is not enough',
		blocks: [
			{
				kind: 'text',
				body: 'Two escalation routes sit above ordinary support, and you are entitled to use them directly.',
			},
			{
				kind: 'list',
				items: [
					`Formal complaints go to our Grievance Officer at ${CONTACTS.grievance}. That mailbox carries a statutory clock: acknowledgement within ${SLA.grievanceAcknowledgement} and resolution within ${SLA.grievanceResolution}. Use it if support has not resolved your issue, or if you want a complaint on the record from the start. Full details, including what to put in the complaint, are on the grievance page at ${COMPANY.website}/grievance.`,
					`Urgent safety reports, including child sexual abuse material, threats to someone's life, or non-consensual intimate imagery, go to ${CONTACTS.childSafety} and are handled ahead of everything else. See ${COMPANY.website}/child-safety.`,
				],
			},
			{
				kind: 'callout',
				tone: 'warn',
				body: 'If someone is in immediate danger, contact your local emergency services first. We are not an emergency service and we cannot respond at that speed.',
			},
		],
	},
]

export default function HelpPage() {
	return (
		<LegalDocument
			title="Help and Support"
			intro={`Answers to the questions we are asked most about ${APP.name}. If yours is not here, email ${CONTACTS.support} and a person will read it.`}
			sections={sections}
			footnote={`${COMPANY.legalName} operates ${APP.name}. For formal complaints see the grievance page; for urgent safety reports see the child safety page.`}
		/>
	)
}
