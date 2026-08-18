import LegalDocument, { Section } from '@/components/LegalDocument'
import DeleteAccountForm from '@/components/DeleteAccountForm'
import { APP, COMPANY, CONTACTS, SLA } from '@/lib/company'

const sections: Section[] = [
	{
		heading: 'The fastest way: delete from inside the app',
		blocks: [
			{
				kind: 'text',
				body: `If you can still sign in, delete your account from the app. It is the quickest route, because it does not wait on anyone at our end.`,
			},
			{
				kind: 'list',
				ordered: true,
				items: [
					`Open ${APP.name} and sign in.`,
					'Go to Settings.',
					'Open Account Management.',
					'Tap Delete your Account and follow the steps.',
				],
			},
			{
				kind: 'text',
				body: 'The app asks you to prove it is you before it will go ahead, even though you are already signed in: you enter your password, or sign in again with Google if that is how you use the account. This is there so that someone who picks up an unlocked phone cannot delete the account on you.',
			},
			{
				kind: 'text',
				body: 'What happens then depends on the kind of account:',
			},
			{
				kind: 'list',
				items: [
					`Registered accounts, meaning anything with an email address, a password or a Google sign-in on it: the deletion is scheduled and the account enters a grace period of ${SLA.accountDeletionGrace}. During that time the deletion is pending and can still be undone. After it ends, the account is deleted and we cannot bring it back.`,
					'Guest accounts: deleted immediately, with no grace period. A guest account has no email or password attached to it, so there is nothing to recover and nothing to sign back in with.',
				],
			},
			{
				kind: 'callout',
				tone: 'info',
				body: `Changed your mind about a registered account? Just log back in before the ${SLA.accountDeletionGrace} are up. Signing in cancels the pending deletion automatically, and there is nothing else to do. A guest account is gone as soon as you confirm.`,
			},
			{
				kind: 'callout',
				tone: 'warn',
				body: `Uninstalling the app does not delete your account. Neither does removing it from your device. You have to request deletion here or in the app.`,
			},
		],
	},
	{
		heading: 'Deleting from the web',
		blocks: [
			{
				kind: 'text',
				body: `You do not need to install ${APP.name} to delete your account. Enter the email address on your account in the box above. We send a confirmation link to that address, and opening it starts the deletion. Only the person who can read the account's email can confirm, so nobody else can delete your account.`,
			},
			{
				kind: 'text',
				body: `Once you confirm, a registered account enters the ${SLA.accountDeletionGrace} grace period, and signing in during that window cancels the deletion. The confirmation link expires in one hour and can be used once.`,
			},
			{
				kind: 'text',
				body: `If you can no longer sign in to the account's email, write to us instead and we will verify ownership another way before deleting anything.`,
			},
			{
				kind: 'contact',
				label: 'If you have lost access to the account email',
				email: CONTACTS.privacy,
				note: `Include the account email, your ${APP.name} username, and your platform (Android or iOS). We reply within ${SLA.supportResponse}.`,
			},
		],
	},
	{
		heading: 'What deletion removes',
		blocks: [
			{
				kind: 'text',
				body: 'When the deletion goes through, we remove:',
			},
			{
				kind: 'list',
				items: [
					'Your account itself, and your sign-in credentials, including the Google link if you used one. Your sessions and signed-in devices go with it, so the account can no longer be signed in to.',
					'Your profile: username, display name, the profile photo and avatar shown on it, your cosmetic selections, and your country.',
					'Your friends and social connections, your blocks, and your hashed contacts if you had turned on contact discovery.',
					'Your inventory of avatars, decks, backgrounds and other items, and your coin and gem balances.',
					'Your gameplay records: match history, rating, level and progression.',
					'Your posts and comments, where you have made any.',
					'Reports you filed about a direct or group message, and reports filed about you there. Reports about a lounge message or an in-match message are kept.',
				],
			},
			{
				kind: 'text',
				body: 'Once your account is gone, other people can no longer open your profile, add you or find you in search. The next section is the honest other half of that: some things do not disappear when the account does.',
			},
		],
	},
	{
		heading: 'What stays behind',
		blocks: [
			{
				kind: 'text',
				body: 'Read this part before you delete, because it is the part people are usually surprised by. Deleting your account does not reach back into other people\'s conversations, and it does not delete the files you uploaded.',
			},
			{
				kind: 'list',
				items: [
					'Messages you sent in direct messages, groups, lounges and in-match chat are deleted along with your account.',
					'Photos, videos and voice notes you uploaded in chat are deleted from our storage. The only exception is a file that was de-duplicated because other people sent the identical one, which stays because it is also theirs.',
				],
			},
			{
				kind: 'text',
				body: 'Anything you shared outside the app, such as a screenshot someone else saved, is not ours to reach and we cannot remove it.',
			},
			{
				kind: 'text',
				body: 'Separately, deletion does not override the law:',
			},
			{
				kind: 'table',
				headers: ['What we keep', 'For how long', 'Why'],
				rows: [
					[
						'Records of purchases and payments',
						'As long as Indian tax and accounting law requires',
						'We are required to keep books and transaction records, and to be able to substantiate them. Note that Google and Apple also hold their own record of any purchase you made through them.',
					],
				],
			},
			{
				kind: 'text',
				body: 'We keep those records for that purpose only. We do not use them to rebuild your profile or to market to you.',
			},
			{
				kind: 'text',
				body: 'Backups and logs are not wiped the instant your account is deleted. They age out on their normal schedule, and we do not restore a deleted account from them.',
			},
		],
	},
	{
		heading: 'Coins, gems and anything you bought',
		blocks: [
			{
				kind: 'callout',
				tone: 'warn',
				body: 'Deleting your account forfeits your coins and gems, including any you paid for. They have no cash value, they cannot be withdrawn or converted to money, and they cannot be transferred to another account. Spend what you want to use before you delete.',
			},
			{
				kind: 'text',
				body: 'The same applies to everything bought with them: avatars, decks, table backgrounds, chat themes and other cosmetics are tied to the account and go with it. Deleting your account is not a refund request. If you think you are owed a refund, raise that first, and remember that purchases made through Google Play or the App Store are handled under their refund policies.',
			},
		],
	},
	{
		heading: 'Other options before you delete',
		blocks: [
			{
				kind: 'text',
				body: 'Deletion is permanent, so it is worth knowing what else is available. You can block a user, report a message or a user, change your username, or simply sign out and leave the account dormant. If your problem is with one person or one conversation, one of those is usually a better fit than losing your account.',
			},
			{
				kind: 'text',
				body: 'If you want a summary of the data we hold about you, or want something corrected rather than deleted, ask us at the same address and say what you want instead.',
			},
		],
	},
	{
		heading: 'Questions',
		blocks: [
			{
				kind: 'contact',
				label: 'Privacy and deletion',
				email: CONTACTS.privacy,
				note: `Deletion requests, data access and correction requests. We reply within ${SLA.informationRequest}.`,
			},
			{
				kind: 'contact',
				label: 'Grievance Officer',
				email: CONTACTS.grievance,
				note: `If a deletion request is not handled properly, escalate it here. We acknowledge within ${SLA.grievanceAcknowledgement} and resolve within ${SLA.grievanceResolution}.`,
			},
		],
	},
]

export default function DeleteAccountPage() {
	return (
		<LegalDocument
			title="Delete your account"
			intro={`How to delete your ${APP.name} account and the data attached to it, from inside the app or from here. ${COMPANY.legalName} operates ${APP.name}.`}
			sections={sections}
			footnote="Deletion is permanent: straight away for a guest account, and once the grace period ends for a registered one. If you are not sure, sign out and come back to it."
		>
			<DeleteAccountForm />
		</LegalDocument>
	)
}
