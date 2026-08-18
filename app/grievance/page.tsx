import LegalDocument, { Section } from '@/components/LegalDocument'
import {
	APP,
	COMPANY,
	CONTACTS,
	GRIEVANCE_APPELLATE,
	GRIEVANCE_OFFICER,
	SLA,
	registeredOfficeInline,
} from '@/lib/company'

/**
 * Grievance redressal disclosure, published under Rule 3(2)(a) of the
 * Information Technology (Intermediary Guidelines and Digital Media Ethics Code)
 * Rules, 2021. The officer's name, designation and contact details come from
 * lib/company.ts.
 *
 * Rule 3(2)(a) also requires these details to be published inside the app. The
 * app has no grievance surface today, so this page does not claim one; add the
 * claim back only once the app actually shows the officer's details.
 *
 * No version stamp: POLICY_VERSIONS has no `grievance` key, and this page is a
 * standing disclosure rather than a versioned policy the user accepts, so it is
 * rendered without one instead of inventing a version number here.
 */

const officerAddress = GRIEVANCE_OFFICER.addressLines.join(', ')

const sections: Section[] = [
	{
		heading: 'Grievance Officer',
		blocks: [
			{
				kind: 'text',
				body: `${COMPANY.legalName} operates ${APP.name}. Under Rule 3(2)(a) of the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, we publish the name and contact details of our Grievance Officer, who is resident in India.`,
			},
			{
				kind: 'list',
				items: [
					`Name: ${GRIEVANCE_OFFICER.name}`,
					`Designation: ${GRIEVANCE_OFFICER.designation}`,
					`Postal address: ${officerAddress}`,
					`Email: ${GRIEVANCE_OFFICER.email}`,
				],
			},
			{
				kind: 'contact',
				label: 'Write to the Grievance Officer',
				email: GRIEVANCE_OFFICER.email,
				note: `You can also write by post to ${GRIEVANCE_OFFICER.designation}, ${COMPANY.legalName}, ${officerAddress}. Email is faster, because a postal complaint is only acknowledged once it reaches us.`,
			},
		],
	},
	{
		heading: 'What a grievance is',
		blocks: [
			{
				kind: 'text',
				body: `A grievance is any complaint about ${APP.name}, about content on it, or about how we have treated you or your data. You do not have to use any particular wording or format. If you tell us what is wrong, we will treat it as a grievance.`,
			},
			{
				kind: 'text',
				body: 'Grievances we handle include:',
			},
			{
				kind: 'list',
				items: [
					'Content that is unlawful, obscene, threatening, harassing, hateful or invades someone\'s privacy.',
					'An account that impersonates you, or a profile using your photo, name or likeness without permission.',
					'Non-consensual intimate imagery, or images that have been morphed or edited into that form.',
					'Content that infringes your copyright, trade mark or other intellectual property.',
					'Harassment, bullying, threats or abuse directed at you in chat, in a lounge, in a match or in comments.',
					'Content or behaviour involving a child, or an account you believe belongs to someone under our minimum age.',
					'A decision we have taken about your account, or about a report you filed, that you think is wrong.',
					'Purchases, coins, gems and refunds, and problems with in-app purchases.',
					'Privacy and data-protection questions, including requests to access, correct or delete your data.',
					'Anything else about the service that you have raised with support and that is still unresolved.',
				],
			},
		],
	},
	{
		heading: 'Report it in the app first, if you can',
		blocks: [
			{
				kind: 'text',
				body: `For ordinary content problems, in-app reporting is the quickest way to get the matter in front of us. ${APP.name} lets you report a message, report a user, and block or unblock a user. A report about a direct message, a group message or a user goes into our review queue; a report about a lounge or in-match message is recorded but is best followed up by email to the address below. Blocking takes effect on your account straight away without waiting for us. You can also delete any message you sent yourself, from inside the conversation.`,
			},
			{
				kind: 'text',
				body: 'Use the Grievance Officer instead when the matter is legally serious, when it concerns your rights over your own data or likeness, when you have no account to report from, or when you have already reported something and it was not resolved. You never have to report in the app first. You can come straight to the Grievance Officer if you prefer.',
			},
		],
	},
	{
		heading: 'Who can file a grievance',
		blocks: [
			{
				kind: 'text',
				body: `Anyone can. You do not need a ${APP.name} account, and you do not need to have ever used the app. This matters most for impersonation: if someone has created an account pretending to be you, you are exactly the person who cannot report it from inside the app, so write to the Grievance Officer instead.`,
			},
			{
				kind: 'text',
				body: 'You can also file on behalf of someone else, for example as a parent or guardian, or as a lawyer or authorised representative. Tell us who you are acting for and in what capacity, so we know how to verify the request.',
			},
		],
	},
	{
		heading: 'What to include',
		blocks: [
			{
				kind: 'text',
				body: 'Send these five things. A complaint that has all of them can usually be acted on straight away, and one that is missing them takes longer only because we have to write back and ask.',
			},
			{
				kind: 'list',
				ordered: true,
				items: [
					'Your contact details: your name, an email address we can reply to, and your username if you have an account.',
					'What content or account the complaint is about: the username, the profile link, the message, the post, or a description clear enough for us to find it. Screenshots help.',
					'Where you saw it: a direct message, a group, a lounge, in-match chat, a post, a comment, a story or a profile, and roughly when.',
					'What is wrong with it: what harm it causes, and if it is unlawful, which law or right it breaches. If it is your copyright or your likeness, say what you own and how you know.',
					'A statement that the information in your complaint is accurate and complete to the best of your knowledge, and that you are the affected person or are authorised to act for them.',
				],
			},
			{
				kind: 'callout',
				tone: 'warn',
				body: 'Do not send more personal information than the complaint needs. In particular, do not attach copies of the offending imagery in a non-consensual intimate imagery complaint. A description and a link are enough for us to find it.',
			},
		],
	},
	{
		heading: 'Our timelines',
		blocks: [
			{
				kind: 'text',
				body: 'These are the clocks the IT Rules 2021 set, and we hold ourselves to them. Time runs from when a complete complaint reaches the Grievance Officer.',
			},
			{
				kind: 'table',
				headers: ['What', 'Within'],
				rows: [
					['Acknowledge your complaint', SLA.grievanceAcknowledgement],
					['Resolve it and tell you the outcome', SLA.grievanceResolution],
					[
						'Act on an order from a court or an authorised government agency about unlawful content',
						SLA.unlawfulContentOrder,
					],
					[
						'Remove non-consensual intimate imagery, or content that impersonates a person, after a valid complaint',
						SLA.intimateImageryTakedown,
					],
					[
						'Respond to a lawful request for information from an authorised government agency',
						SLA.informationRequest,
					],
				],
			},
		],
	},
	{
		heading: 'What we undertake to do',
		blocks: [
			{
				kind: 'text',
				body: 'This is what we commit to on every grievance.',
			},
			{
				kind: 'list',
				ordered: true,
				items: [
					`We acknowledge your complaint by email within ${SLA.grievanceAcknowledgement} and give it a reference.`,
					'A person reads it. If we need more detail, or need to confirm that you are the affected person, we ask you once and clearly.',
					'We decide the complaint and record the decision against it.',
					`We write back with the decision and the reason for it, within ${SLA.grievanceResolution}. If the decision is that we are taking no action, we say so plainly rather than leaving the complaint open.`,
				],
			},
			{
				kind: 'text',
				body: 'If you disagree with the decision, reply to the same email thread and ask us to look at it again. Say what you think we got wrong and add anything new, and we will consider it and write back.',
			},
			{
				kind: 'text',
				body: `If you are still not satisfied, the IT Rules 2021 give you a right to appeal to a ${GRIEVANCE_APPELLATE.name}. The Committees are constituted by the Central Government under Rule 3A and are reached through their own portal at ${GRIEVANCE_APPELLATE.domain}, not through us: you file the appeal there yourself, within ${GRIEVANCE_APPELLATE.appealWindow} of receiving our decision. Nothing on this page takes away your right to approach a court or any other authority instead.`,
			},
		],
	},
	{
		heading: 'Law enforcement, courts and government agencies',
		blocks: [
			{
				kind: 'text',
				body: 'Court orders, notices, and requests for information or content removal from authorised government agencies should be sent to our legal mailbox rather than to the Grievance Officer, so they are routed correctly.',
			},
			{
				kind: 'contact',
				label: 'Legal and law enforcement requests',
				email: CONTACTS.legal,
				note: `By post: Legal, ${COMPANY.legalName}, ${registeredOfficeInline()}. Please include the issuing authority, the statutory provision relied on, the account or content identifiers, and a contact for follow-up. We act on orders about unlawful content within ${SLA.unlawfulContentOrder} and on lawful information requests within ${SLA.informationRequest}.`,
			},
			{
				kind: 'text',
				body: 'We disclose user information only where the law requires it, and only the information the request actually covers. If a request is overbroad or defective, we say so and ask for it to be corrected rather than over-disclosing.',
			},
		],
	},
	{
		heading: 'Other ways to reach us',
		blocks: [
			{
				kind: 'contact',
				label: 'General support',
				email: CONTACTS.support,
				note: `Everyday problems with the app, your account or a purchase. We aim to reply within ${SLA.supportResponse}.`,
			},
			{
				kind: 'contact',
				label: 'Privacy and your data',
				email: CONTACTS.privacy,
				note: 'Access, correction, deletion and other data-protection requests.',
			},
			{
				kind: 'contact',
				label: 'Child safety',
				email: CONTACTS.childSafety,
				note: 'Reports involving a child, including child sexual abuse material. These are treated as the highest priority.',
			},
		],
	},
]

export default function GrievancePage() {
	return (
		<LegalDocument
			title="Grievance Redressal"
			intro={`How to raise a complaint about ${APP.name}, who handles it, and how long we take. Published under Rule 3(2)(a) of the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021.`}
			sections={sections}
			footnote={`${COMPANY.legalName}, ${registeredOfficeInline()}. Published under Rule 3(2)(a) of the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021.`}
		/>
	)
}
