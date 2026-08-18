import LegalDocument, { Section } from '@/components/LegalDocument'
import {
	APP,
	COMPANY,
	CONTACTS,
	GRIEVANCE_OFFICER,
	POLICY_VERSIONS,
	SLA,
	registeredOfficeInline,
} from '@/lib/company'

/**
 * Community Guidelines.
 *
 * These are the published content standards required of user-generated content
 * apps, and the document the Terms of Service points at as binding on every
 * account. Everything here describes controls that exist in the product today;
 * where a right is exercised by writing to us rather than by tapping a button,
 * the page says so.
 */

const sections: Section[] = [
	{
		heading: 'Who these guidelines apply to',
		blocks: [
			{
				kind: 'text',
				body: `These Community Guidelines apply to everyone who uses ${APP.name}, the app operated by ${COMPANY.legalName}. They cover everything you post, send or display: direct messages, group chats, lounges, in-match chat, posts, comments, stories, photos, videos, GIFs, stickers, your username, your display name and your profile photo.`,
			},
			{
				kind: 'text',
				body: `They apply in private conversations as well as public ones. A message being sent to one person does not put it outside these rules. Your Terms of Service acceptance includes these guidelines, so breaking them is also a breach of the Terms.`,
			},
			{
				kind: 'callout',
				tone: 'info',
				body: `You must be at least ${APP.minimumAge} to hold an account. Child safety is handled separately and more strictly: see our Child Safety Standards page.`,
			},
		],
	},
	{
		heading: 'What is not allowed',
		blocks: [
			{
				kind: 'text',
				body: 'Do not post, send, share or link to any of the following. This list is not a loophole hunt: if something is clearly designed to hurt, deceive or endanger another person, treat it as covered.',
			},
			{
				kind: 'list',
				items: [
					'Harassment and bullying: targeting someone with insults, unwanted sexual attention, repeated unwanted contact, pile-ons, or threats to expose them.',
					'Hate speech: attacking or dehumanising people because of their religion, caste, ethnicity, national origin, race, colour, sex, gender identity, sexual orientation, disability or serious disease.',
					'Sexual content: pornography, sexually explicit images or video, and sexual solicitation. Nudity is not permitted anywhere in the app.',
					'Child endangerment: any sexual content involving a minor, any sexualisation of a minor, grooming, and any attempt to contact a minor for sexual purposes. This is covered in full on our Child Safety Standards page.',
					'Violence and threats: threatening to harm or kill someone, glorifying violence, or celebrating a violent act or the suffering of its victims.',
					'Terrorism and violent extremism: praising, promoting or recruiting for a terrorist organisation or a violent extremist cause.',
					'Illegal goods and services: buying, selling or arranging drugs, weapons, counterfeit goods, stolen data, or any other item or service whose sale is illegal in India.',
					'Self-harm and suicide promotion: encouraging suicide, self-injury or disordered eating, or sharing methods or instructions.',
					'Spam: unsolicited bulk messages, repeated identical messages, mass unsolicited friend requests, chain messages, or using the app mainly to drive people somewhere else.',
					'Scams and fraud: fake giveaways, investment or betting tips, "double your coins" offers, phishing for passwords or one-time codes, and any attempt to trick someone out of money or account access.',
					'Impersonation: pretending to be another person, a member of our staff, a public figure, or an organisation, including through your username, display name or profile photo.',
					'Doxxing: publishing anyone’s private information without their consent, including phone numbers, addresses, workplace, identity-document numbers, financial details or private photographs.',
					'Non-consensual and morphed intimate imagery: sexual or intimate images of a person shared without their consent, and edited or synthetic images that place someone in sexual or intimate content.',
					'Malware and phishing: links or files that install unwanted software, steal credentials or harvest data.',
					'Anything unlawful: content or conduct that breaks Indian law, or the law where you are.',
				],
			},
		],
	},
	{
		heading: 'Rules specific to games, coins and accounts',
		blocks: [
			{
				kind: 'text',
				body: `${APP.name} games are free to play — there is no entry fee, stake or prize on any match. Coins and gems are virtual items with no cash value: they cannot be withdrawn, converted to money or transferred off the platform. The rules below exist to keep games fair and to keep the currency inside the app.`,
			},
			{
				kind: 'list',
				items: [
					'No cheating: do not use bots, scripts, automation, modified clients, memory editors, packet tampering, or any tool that plays for you or reveals information the game does not show you.',
					'No exploiting bugs: if you find a fault that gives you an advantage, stop using it and report it. Continuing to use it is cheating.',
					'No collusion: do not coordinate with another player to fix the outcome of a match, and do not deliberately lose to feed someone a win, a rating or a leaderboard place. In team modes, play the game.',
					'No multiple accounts to gain an advantage: do not run several accounts to claim rewards more than once, to stack a table, or to get around a restriction on another account.',
					'No buying or selling for real money: accounts, coins, gems, cosmetics and in-game items may not be sold, bought, traded, rented or auctioned for money or anything else of value. There is no legitimate outside market for them.',
					'No account sharing: your account is yours. Do not share your password, do not let someone else play on it, and do not take over an account that is not yours.',
					'No abuse of purchases or refunds: do not reverse payments for items you have already used, and do not use stolen payment details.',
					'No abuse of the reporting tools: do not file false reports to punish someone you lost to.',
				],
			},
			{
				kind: 'text',
				body: 'Some seats at a table can be filled by computer-controlled players that we run, so not every opponent you meet is another person. That is us, and the cheating rule above is about automation you run on your own account.',
			},
			{
				kind: 'callout',
				tone: 'warn',
				body: 'Coins and gems bought with real money have no cash value and are never redeemable for money. If your account is closed for breaking these rules, any remaining balance goes with it.',
			},
		],
	},
	{
		heading: 'The tools you have in the app',
		blocks: [
			{
				kind: 'text',
				body: 'These controls are live in the app today.',
			},
			{
				kind: 'list',
				items: [
					'Report a message: report an individual message and tell us why. You can add a description.',
					'Report a user: report an account rather than a single message, with a reason and a description.',
					'Block a user: blocking stops that person contacting you. You can see and undo your blocks from your blocked list.',
					'Automatic language filter: match chat in Tero and Chess, and lounge chat, are screened against a blocklist and offensive messages are rejected before they are sent.',
					'Delete your own message: you can delete a message you sent, in a direct message, a group chat or a lounge. Only the person who sent a message can delete it.',
					'Leave or mute: you can leave a group or a lounge at any time, and mute a chat or a group so it stops notifying you, without reporting anyone.',
				],
			},
			{
				kind: 'text',
				body: 'Direct messages and group chats are not automatically screened. If someone sends you something that breaks these guidelines there, report the message and block the sender, and we will look at it.',
			},
			{
				kind: 'text',
				body: `If something is not covered by the in-app tools, or you are reporting on behalf of someone else, write to our Grievance Officer at ${GRIEVANCE_OFFICER.email}.`,
			},
		],
	},
	{
		heading: 'How to report something',
		blocks: [
			{
				kind: 'list',
				ordered: true,
				items: [
					'For a specific message, use the report option on that message. Choose a reason and add anything that helps us understand it.',
					'For an account, use the report option on that user’s profile.',
					'Block the person as well if you do not want further contact. Reporting and blocking are separate actions.',
					`For anything the in-app tools do not cover, including complaints about our own handling of a report, email ${GRIEVANCE_OFFICER.email} with the usernames involved, what happened, and when.`,
					`If there is an immediate risk to someone’s life or safety, contact your local emergency services first, then tell us at ${CONTACTS.grievance}.`,
				],
			},
			{
				kind: 'callout',
				tone: 'info',
				body: 'Reporting is private. We do not tell the person you reported them, and we do not show them your report.',
			},
		],
	},
	{
		heading: 'What happens after you report',
		blocks: [
			{
				kind: 'text',
				body: 'Every report is stored. Reports about a direct message, a group message or a user are put in front of a person on our team, who reads the report and the surrounding context and records an outcome against it. Reports about a lounge message or an in-match message are stored but are not yet surfaced for review, so if something there needs attention, report the user from their profile or write to us.',
			},
			{
				kind: 'text',
				body: 'We may look at the reported message, related messages in the same conversation, the account history of the person reported, and any earlier reports about them. We weigh the seriousness of what happened, whether it looks deliberate, and whether it has happened before.',
			},
			{
				kind: 'text',
				body: 'We will not always be able to tell you the outcome in detail, because the other person also has privacy. The app does not send you a notification when a report is closed. If you want to know what came of a report, write to the Grievance Officer with the details and we will answer you.',
			},
			{
				kind: 'text',
				body: 'A report about a direct or group message is removed if either account involved is deleted. A report about a lounge message or an in-match message is kept.',
			},
		],
	},
	{
		heading: 'What follows a report, and what you can do yourself',
		blocks: [
			{
				kind: 'text',
				body: 'We would rather describe this narrowly and accurately than promise you a machine we do not have. Filing a report does two things today: for a direct message, a group message or a user it puts the report in front of a person on our team, and in every case it creates a record that we track to a status, so the report has an outcome recorded against it rather than being dropped.',
			},
			{
				kind: 'text',
				body: 'Alongside that, the controls in your own hands are immediate and do not wait on us:',
			},
			{
				kind: 'list',
				items: [
					'Block the person. That stops them contacting you, and you can undo it from your blocked list.',
					'Delete a message you sent, whether it was in a direct message, a group chat or a lounge.',
					'Leave a group or a lounge, or mute a chat or group so it stops notifying you.',
				],
			},
			{
				kind: 'text',
				body: 'These are the fastest way to end unwanted contact, and we would use them first even while a report is open.',
			},
			{
				kind: 'text',
				body: 'Separately from all of that, the Terms of Service reserve rights to us that we may exercise against an account that breaks these guidelines. We may remove or refuse content, we may restrict or suspend an account, we may close an account permanently, and we may reverse coins, gems or items obtained through cheating, collusion, exploiting a fault or duplicate accounts. Those are rights we hold and may use, decided case by case by a person, and not a description of an automated pipeline that runs on your report.',
			},
			{
				kind: 'text',
				body: 'For the most serious categories, including child endangerment, credible threats to a person, and fraud against other players, we do not work through a fixed number of chances before we act.',
			},
			{
				kind: 'text',
				body: 'Where the law requires it, we report the matter to the appropriate authorities and answer lawful requests from them for the records we hold.',
			},
		],
	},
	{
		heading: 'If you think we got it wrong',
		blocks: [
			{
				kind: 'text',
				body: `You can appeal any decision we take about your account or your content, and you can complain about how we handled a report you filed. Appeals go to our Grievance Officer, who is a person at ${COMPANY.shortName} and reads what you send.`,
			},
			{
				kind: 'contact',
				label: GRIEVANCE_OFFICER.designation,
				email: GRIEVANCE_OFFICER.email,
				note: `${GRIEVANCE_OFFICER.name}, ${GRIEVANCE_OFFICER.designation}, ${COMPANY.legalName}. Postal address: ${registeredOfficeInline()}.`,
			},
			{
				kind: 'text',
				body: 'Include your username, the date, what action was taken against you if you know it, and why you think it was wrong. If you have context we could not have seen, send it: that is usually what changes an outcome.',
			},
			{
				kind: 'text',
				body: 'We will look at the decision again and reply to you with the outcome, within the times set out below. If we were wrong, we say so, and we undo what we can still undo.',
			},
		],
	},
	{
		heading: 'How quickly we respond',
		blocks: [
			{
				kind: 'text',
				body: 'These are the clocks we hold ourselves to, and the ones Indian law holds us to.',
			},
			{
				kind: 'table',
				headers: ['What', 'Within'],
				rows: [
					['We acknowledge a grievance or an appeal', SLA.grievanceAcknowledgement],
					['We resolve a grievance or an appeal', SLA.grievanceResolution],
					[
						'We remove non-consensual or morphed intimate imagery after a valid complaint',
						SLA.intimateImageryTakedown,
					],
					[
						'We act on a court order or a valid government direction to remove content',
						SLA.unlawfulContentOrder,
					],
					[
						'We respond to a lawful request for information from an authorised agency',
						SLA.informationRequest,
					],
					['General support replies', SLA.supportResponse],
				],
			},
			{
				kind: 'text',
				body: 'Serious safety reports, especially anything involving a child or an immediate threat to life, are pushed to the front of the queue ahead of everything else.',
			},
		],
	},
	{
		heading: 'Changes to these guidelines',
		blocks: [
			{
				kind: 'text',
				body: `We update these guidelines as the app changes and as we learn what people actually do with it. The version number and effective date at the top of this page change with it, and we notify you in the app when the substance changes. Continuing to use ${APP.name} after that means you accept the updated guidelines.`,
			},
		],
	},
	{
		heading: 'Contact',
		blocks: [
			{
				kind: 'contact',
				label: 'Report abuse or appeal a decision',
				email: CONTACTS.grievance,
				note: `Acknowledged within ${SLA.grievanceAcknowledgement}, resolved within ${SLA.grievanceResolution}.`,
			},
			{
				kind: 'contact',
				label: 'Child safety (highest priority)',
				email: CONTACTS.childSafety,
				note: 'Use this for anything involving a child. See our Child Safety Standards page.',
			},
			{
				kind: 'contact',
				label: 'General support',
				email: CONTACTS.support,
				note: `Replies within ${SLA.supportResponse}.`,
			},
			{
				kind: 'text',
				body: `${COMPANY.legalName}, ${registeredOfficeInline()}.`,
			},
		],
	},
]

export default function CommunityGuidelinesPage() {
	return (
		<LegalDocument
			title="Community Guidelines"
			intro={`${APP.name} is a place to play games and talk to people. These guidelines are the rules for that: what you can post, what you cannot, how to report someone who breaks the rules, what we do about it, and how to challenge us if you think we were wrong. They are part of your agreement with us.`}
			version={POLICY_VERSIONS.community.version}
			effective={POLICY_VERSIONS.community.effective}
			sections={sections}
			footnote={`These guidelines form part of the Terms of Service for ${APP.name}. Read them alongside our Privacy Policy and our Child Safety Standards.`}
		/>
	)
}
