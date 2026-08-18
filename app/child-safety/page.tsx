import LegalDocument, { Section } from '@/components/LegalDocument'
import {
	APP,
	CHILD_SAFETY_RESOURCES,
	COMPANY,
	CONTACTS,
	GRIEVANCE_OFFICER,
	POLICY_VERSIONS,
	SLA,
	registeredOfficeInline,
} from '@/lib/company'

/**
 * Child Safety Standards.
 *
 * Published standards for a social app: the zero-tolerance position on child
 * sexual abuse and exploitation (CSAE), the reporting route, the law
 * enforcement point of contact, and the statutory obligations we work to.
 */

const sections: Section[] = [
	{
		heading: 'Our position',
		blocks: [
			{
				kind: 'callout',
				tone: 'warn',
				body: `${COMPANY.legalName} has zero tolerance for child sexual abuse and exploitation (CSAE). There is no warning, no second chance and no appeal on the substance. A report of it goes to the front of our queue, a person reviews it, and we report the matter to the appropriate authorities.`,
			},
			{
				kind: 'text',
				body: `${APP.name} is an adult app. It is not designed for children, it is not marketed to children, and children are not permitted to use it. We treat any signal that a child is present, or is being targeted, as the most serious thing in our queue.`,
			},
		],
	},
	{
		heading: 'Minimum age',
		blocks: [
			{
				kind: 'text',
				body: `You must be at least ${APP.minimumAge} years old to hold a ${APP.name} account. That is a condition of the Terms of Service and a condition of these standards, and it applies to every account without exception.`,
			},
			{
				kind: 'text',
				body: `We should be plain about how that rule is applied. We do not collect your date of birth, and the app does not put an age screen in front of you at sign-up. The minimum age is a rule we act on when someone tells us it has been broken, not a check the app performs by itself.`,
			},
			{
				kind: 'text',
				body: `So tell us. A report that an account belongs to someone under ${APP.minimumAge} is treated as a child safety report: it goes to the front of the queue and a person looks at it. You do not need to prove it to a legal standard before we act, and you do not need to be certain. Where we reasonably believe an account belongs to a child, we reserve the right to close it and to refuse it access again, and we may ask for age verification before we reconsider.`,
			},
			{
				kind: 'text',
				body: 'Under Indian data protection law anyone under 18 is a child, and we do not knowingly process a child’s personal data. If we learn that we have, we treat that as a child safety matter and act on it under this page.',
			},
		],
	},
	{
		heading: 'What is prohibited',
		blocks: [
			{
				kind: 'text',
				body: 'The following are banned outright, everywhere in the app, in public rooms and in private messages alike:',
			},
			{
				kind: 'list',
				items: [
					'Child sexual abuse material (CSAM) in any form: images, video, audio, drawings, animation, computer-generated or AI-generated depictions, and links to any of it.',
					'Sexualisation of a minor: sexual commentary about a child, sexualised depictions of children, or presenting a child as an object of sexual interest.',
					'Grooming: building a relationship with a child in order to sexually exploit or abuse them, including gifts of coins, gems or items offered for that purpose.',
					'Sexual solicitation of a minor, or attempting to arrange an offline meeting with a minor for sexual purposes.',
					'Sextortion: threatening to release intimate images of a person in order to obtain more images, money or anything else.',
					'Advertising, trading, requesting or offering to obtain CSAM, and any coded language used to do so.',
					'Non-consensual and morphed intimate imagery of any person, including images altered or synthetically generated to sexualise someone.',
					'Any other conduct that endangers a child.',
				],
			},
			{
				kind: 'text',
				body: 'This applies regardless of whether the material was created on our platform, whether the account holder claims it was a joke, and whether anyone else saw it.',
			},
		],
	},
	{
		heading: 'How to report suspected child sexual abuse or exploitation',
		blocks: [
			{
				kind: 'text',
				body: `Anyone can report this to us. You do not need a ${APP.name} account, you do not need to be the person affected, and you do not need to be sure. Send it and let us look.`,
			},
			{
				kind: 'contact',
				label: 'Child safety reports',
				email: CONTACTS.childSafety,
				note: `Monitored as our highest priority. Reports of non-consensual or sexualised imagery are actioned within ${SLA.intimateImageryTakedown} of a valid complaint.`,
			},
			{
				kind: 'text',
				body: 'Tell us as much as you can: the username or profile link of the account involved, where it happened (direct message, group, lounge, in-match chat, a post or a story), roughly when, and what was said or shared. Do not attach the material itself. Describing it is enough, and forwarding it can itself be an offence.',
			},
			{
				kind: 'text',
				body: 'You can also use the in-app report on the message or the user. Always email the address above as well when a child may be involved: email is the route we monitor for urgent child-safety reports, and it is the one that gets priority handling.',
			},
			{
				kind: 'callout',
				tone: 'warn',
				body: `If a child is in immediate danger, contact the police first. In India you can also reach the ${CHILD_SAFETY_RESOURCES.helpline.label} on ${CHILD_SAFETY_RESOURCES.helpline.number} and report online child sexual abuse material through the ${CHILD_SAFETY_RESOURCES.cybercrimePortal.name} at ${CHILD_SAFETY_RESOURCES.cybercrimePortal.domain}. Then tell us as well, so that we know about the account on our side.`,
			},
		],
	},
	{
		heading: 'What we do when we receive a report',
		blocks: [
			{
				kind: 'text',
				body: 'These are undertakings we give about how we handle a child safety report. We have written them as what we commit to do on receiving one, because that is what they are: decisions taken by people at this company, not steps carried out automatically by the app.',
			},
			{
				kind: 'list',
				ordered: true,
				items: [
					'We move it to the front of the queue. Child safety reports are handled ahead of every other kind of report.',
					'A person reads it. There is no automated verdict on a report of this kind, and it is not closed by a filter.',
					'We report the matter to the appropriate Indian authorities, including the police or the cybercrime authorities with jurisdiction, and we cooperate with lawful requests for further information.',
					'Where an authority asks us to preserve records we hold about the accounts involved, we do so, and we answer lawful requests for them within the timelines published on this page.',
					'We reserve the right, under our Terms of Service, to close any account involved, and an account closed for this reason is not reinstated.',
				],
			},
			{
				kind: 'text',
				body: 'We do not tell the account holder who reported them. We do not accept an explanation as a reason to reinstate CSAE content.',
			},
			{
				kind: 'text',
				body: `While a report is open, do not wait on us for your own safety. Blocking the account stops it contacting you, and you can leave or mute any group or lounge where it is present. If a child is involved, report it to the police as well as to ${CONTACTS.childSafety}.`,
			},
		],
	},
	{
		heading: 'Non-consensual and morphed intimate imagery',
		blocks: [
			{
				kind: 'text',
				body: `If you tell us that content on ${APP.name} shows you (or a person you are reporting for) nude, in part or in full, in a sexual act, or in an intimate state, and it was shared without consent, or it is an edited, morphed or synthetically generated image made to look that way, we will remove it within ${SLA.intimateImageryTakedown} of receiving your complaint. This is the timeline set by the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, and we treat it as a hard deadline.`,
			},
			{
				kind: 'text',
				body: `Send these to ${CONTACTS.grievance}, or to ${CONTACTS.childSafety} if the person shown is or may be a child. A complaint can be made by the person shown or by someone acting on their behalf.`,
			},
		],
	},
	{
		heading: 'Point of contact for law enforcement',
		blocks: [
			{
				kind: 'text',
				body: 'Law enforcement agencies, courts and government authorities can reach us directly. We accept preservation requests, disclosure requests and takedown orders at the addresses below, and we respond within the statutory timelines.',
			},
			{
				kind: 'contact',
				label: 'Law enforcement and legal requests',
				email: CONTACTS.legal,
				note: `Requests for information from an authorised agency are answered within ${SLA.informationRequest}. Court orders and valid government directions to remove content are actioned within ${SLA.unlawfulContentOrder}.`,
			},
			{
				kind: 'contact',
				label: GRIEVANCE_OFFICER.designation,
				email: GRIEVANCE_OFFICER.email,
				note: `${GRIEVANCE_OFFICER.name}, ${GRIEVANCE_OFFICER.designation}, ${COMPANY.legalName}. Address for service: ${registeredOfficeInline()}.`,
			},
			{
				kind: 'text',
				body: 'Please send requests on official letterhead, identify the legal authority you are acting under, and include the usernames, account identifiers or content links concerned so we can find the right records.',
			},
		],
	},
	{
		heading: 'For parents and guardians',
		blocks: [
			{
				kind: 'text',
				body: `If you believe a child in your care has an account on ${APP.name}, tell us. Write to ${CONTACTS.childSafety} from an address we can reply to, and include the username or the email address on the account, the child’s age, and your relationship to them. We may ask for something that lets us confirm you are the parent or guardian before we act, because we do not want this route used to close someone else’s account.`,
			},
			{
				kind: 'text',
				body: 'Closing an account deletes the account itself and the profile, gameplay and balance records attached to it, subject to records the law requires us to keep, such as purchase and tax records. Two things do not go with it, and you should know this before you write to us: messages already sent stay in the conversations they were sent to, and files already uploaded remain stored at the link they were served from. Our Privacy Policy sets out what deletion does and does not cover.',
			},
			{
				kind: 'text',
				body: `If you believe an adult on our platform has contacted or attempted to contact a child, report it to the police, and tell us at ${CONTACTS.childSafety} so that we know about the account.`,
			},
			{
				kind: 'text',
				body: 'Google Play and the Apple App Store both offer parental controls that restrict downloads by age rating and require approval for purchases. Set them up on any device a child uses. They are the strongest control available for keeping an adult app off that device, and they work whether or not we ever hear about the account.',
			},
		],
	},
	{
		heading: 'Legal compliance',
		blocks: [
			{
				kind: 'text',
				body: 'We operate under Indian law and comply with, among others:',
			},
			{
				kind: 'list',
				items: [
					'The Protection of Children from Sexual Offences Act, 2012 (POCSO), including the obligation to report knowledge of a sexual offence against a child to the police or the Special Juvenile Police Unit.',
					'Section 67B of the Information Technology Act, 2000, which criminalises publishing, transmitting, browsing or storing material depicting children in sexually explicit conduct.',
					'The Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, including the duty to publish these standards, to run a grievance mechanism with a named Grievance Officer, to remove non-consensual or morphed intimate imagery within 24 hours of a complaint, and to act on court orders and government directions within 36 hours.',
					'The Digital Personal Data Protection Act, 2023, which treats anyone under 18 as a child and prohibits processing a child’s personal data without verifiable parental consent. We do not permit children on the platform at all.',
				],
			},
			{
				kind: 'text',
				body: 'Where a user is outside India, we also cooperate with the competent authorities in that jurisdiction where the law requires it.',
			},
		],
	},
	{
		heading: 'Keeping these standards current',
		blocks: [
			{
				kind: 'text',
				body: `We review these standards as the app changes and as guidance from regulators and platform operators changes. The version and effective date at the top of this page move with it. Questions about this page can go to ${CONTACTS.legal}; reports always go to ${CONTACTS.childSafety}.`,
			},
		],
	},
]

export default function ChildSafetyPage() {
	return (
		<LegalDocument
			title="Child Safety Standards"
			intro={`Where ${COMPANY.legalName} stands on child sexual abuse and exploitation on ${APP.name}, and what we do when it is reported to us. This page also tells you how to report it, how law enforcement can reach us, and what parents and guardians can ask us to do.`}
			version={POLICY_VERSIONS.childSafety.version}
			effective={POLICY_VERSIONS.childSafety.effective}
			sections={sections}
			footnote={`Read these standards alongside our Community Guidelines, our Terms of Service and our Privacy Policy. If anything on this page conflicts with a legal obligation we owe, the legal obligation wins.`}
		/>
	)
}
