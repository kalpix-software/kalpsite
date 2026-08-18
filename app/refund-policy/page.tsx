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

const sections: Section[] = [
	{
		heading: 'What this policy covers',
		blocks: [
			{
				kind: 'text',
				body: `This policy explains when you get your money back, when you get items or coins back instead, and when nothing is refundable. It applies to everything you can pay for in ${APP.name}.`,
			},
			{
				kind: 'list',
				items: [
					'Coins and gems bought with real money.',
					'Cosmetic items bought in the store: avatars, card decks, table backgrounds and chat themes.',
				],
			},
			{
				kind: 'text',
				body: `${COMPANY.legalName} publishes this policy as the seller of the in-app content. It sits alongside our Terms of Service and Privacy Policy. Nothing here takes away a right you have under Indian consumer law or under the law of the country you live in.`,
			},
		],
	},

	{
		heading: 'Google and Apple take the payment, not us',
		blocks: [
			{
				kind: 'text',
				body: `Purchases in ${APP.name} are processed through Google Play Billing on Android or Apple in-app purchase on iOS. We do not run a payment page of our own, and we never see or store your card, UPI or bank details. Google or Apple is the merchant for the payment itself, so their refund rules apply to the charge first.`,
			},
			{
				kind: 'callout',
				tone: 'info',
				body: 'Because the store holds the money, the store is always the fastest route to getting a charge reversed. We can credit, restore or replace items inside the app, but we cannot reverse a payment that Google or Apple processed.',
			},
			{
				kind: 'table',
				headers: ['Store', 'Where to ask', 'What they can do'],
				rows: [
					[
						'Google Play (Android)',
						'Open the Play Store app or your Google Play order history on the web, find the order, and use the refund option on it.',
						'Reverse the charge. Google sets its own time limit for self-service requests and decides each case.',
					],
					[
						'Apple App Store (iOS)',
						'Use Apple’s "Report a Problem" page, signed in with the Apple Account that made the purchase.',
						'Reverse the charge. Apple sets its own time limit and decides each case.',
					],
				],
			},
			{
				kind: 'text',
				body: 'Store refund windows and rules are set by Google and Apple and can change without notice from us. If the store turns you down and you believe the refund is owed because something went wrong on our side, write to us with the evidence listed below and we will look at it ourselves.',
			},
		],
	},

	{
		heading: 'What we fix ourselves',
		blocks: [
			{
				kind: 'text',
				body: 'These are the cases we handle directly, without you needing to go to the store. In most of them the fix is items or coins credited back to your account rather than money, because the money never went astray in the first place.',
			},
			{
				kind: 'table',
				headers: ['What happened', 'What we do'],
				rows: [
					[
						'The store confirms the charge but the coins, gems or item never arrived in your account.',
						'We match your receipt against our records and credit what you paid for. This is the most common problem and we fix it directly.',
					],
					[
						'You were charged twice for the same thing.',
						'We credit the second purchase to your account, or, if you would rather have the money back, we confirm the duplicate in writing so you can take it to the store.',
					],
					[
						'A purchase failed part way through and your balance is wrong.',
						'We reconcile your balance against our transaction ledger and correct it.',
					],
					[
						'An item you bought is missing, broken, or clearly not what the store screen said it was.',
						'We repair or replace it, or credit its value back in the currency you paid with.',
					],
				],
			},
		],
	},

	{
		heading: 'Virtual items are delivered immediately',
		blocks: [
			{
				kind: 'text',
				body: 'Coins, gems and cosmetic items are delivered to your account within seconds of the store confirming your payment. There is no shipping, no waiting period and no cancellation window between paying and receiving, so there is nothing to cancel once the purchase completes.',
			},
			{
				kind: 'text',
				body: 'Because delivery is immediate and complete, these purchases are final sale except where the law requires otherwise, or where one of the situations in the section above applies. If a consumer law that covers you gives you a cooling-off or cancellation right for digital content, that right stands and this policy does not override it.',
			},
		],
	},

	{
		heading: 'What we will not refund',
		blocks: [
			{
				kind: 'list',
				items: [
					'Coins or gems you have already spent. Currency is consumed the moment you use it, on a store item or anything else, and a spent balance cannot be restored.',
					'A purchase you changed your mind about after the items were delivered and are still in your account unused, unless a law that applies to you says otherwise.',
					'Coins or gems you earned rather than bought, for example from daily login rewards or gameplay. Nothing was paid, so there is nothing to refund.',
					'Purchases on an account we have closed for breaking the Terms of Service or the Community Guidelines. We reserve the right to close an account for a breach, and where we do, the coins, gems and items on it are forfeited.',
					'Purchases made by someone else using your unlocked device. We can help you secure the account, but the charge itself is between you and the store, so use the store’s purchase authentication and family controls.',
				],
			},
			{
				kind: 'callout',
				tone: 'warn',
				body: `You must be at least ${APP.minimumAge} to hold an account and to buy anything. If a purchase was made on an account that should never have existed, tell us and we will deal with the account and the purchase together.`,
			},
		],
	},

	{
		heading: 'You paid but nothing arrived',
		blocks: [
			{
				kind: 'text',
				body: 'Send this to support and we can usually resolve it in one reply. Without the order details we cannot match your payment to a transaction and we will only have to come back and ask.',
			},
			{
				kind: 'list',
				ordered: true,
				items: [
					'The store order id. It is shown in your Play Store order history, or in the receipt email Google or Apple sent you.',
					'The transaction id or receipt number from that same email.',
					'The date and time of the purchase, and your time zone.',
					'Exactly what you bought: the coin or gem pack, or the item name.',
					`Your ${APP.name} username and the email address on your ${APP.name} account.`,
					'A screenshot of the receipt or the bank line, if you have one.',
				],
			},
			{
				kind: 'callout',
				tone: 'info',
				body: `Write from the email address on your ${APP.name} account where you can. It is the quickest way for us to confirm the account is yours, and it saves a round trip.`,
			},
			{
				kind: 'contact',
				label: 'Purchase and refund support',
				email: CONTACTS.support,
				note: `We aim to reply within ${SLA.supportResponse}.`,
			},
		],
	},

	{
		heading: 'Failed and duplicate transactions',
		blocks: [
			{
				kind: 'text',
				body: 'If a payment fails, the store normally does not charge you at all. A pending line on your bank or card statement that never becomes a real charge is an authorisation hold placed by your bank, and it drops off on its own. We do not control it and we cannot release it.',
			},
			{
				kind: 'text',
				body: 'If money did leave your account and you got nothing, treat it as the case above and send us the order details. If the same order was charged more than once, send us both order ids. We check our ledger, confirm what we actually delivered, and either credit the difference or confirm the duplicate in writing so the store can reverse it.',
			},
		],
	},

	{
		heading: 'Games are free — no entry fees',
		blocks: [
			{
				kind: 'text',
				body: 'Tero and Chess are free to play. There is no entry fee, no stake and no prize pool on any match, so there is nothing to charge, settle or refund for playing a game. Coins are never put at risk on a match.',
			},
			{
				kind: 'callout',
				tone: 'warn',
				body: 'Coins and gems have no cash value. They cannot be withdrawn, exchanged for money, cashed out, or transferred to another person or off the platform. A refund of a purchase means the store returning your money or us restoring items or currency to your account. We never pay currency out as money.',
			},
		],
	},

	{
		heading: 'Chargebacks',
		blocks: [
			{
				kind: 'text',
				body: 'A chargeback is when you ask your bank or card issuer to reverse a charge instead of using the store’s own refund process. Please come to us or to the store first. It is faster, and it does not put your account at risk.',
			},
			{
				kind: 'text',
				body: 'When a chargeback lands, the store claws the money back from us, and the store may block further purchases from your payment method. That part is decided by Google or Apple, not by us.',
			},
			{
				kind: 'text',
				body: 'On our side, we reserve the right to reverse the coins, gems or items the charge paid for, to reverse anything bought with them, and to suspend or close the account the purchase was made on until the balance is settled. Those are rights we reserve under the Terms of Service. If the charge was genuinely fraudulent, tell us and we will treat it as a security problem rather than a chargeback.',
			},
		],
	},

	{
		heading: 'How to ask, and how long we take',
		blocks: [
			{
				kind: 'text',
				body: `Email support with the details listed above. We aim to reply within ${SLA.supportResponse}, and that first reply will either resolve it or tell you exactly what else we need. If a refund or credit is due, we make it as soon as we have confirmed the transaction.`,
			},
			{
				kind: 'text',
				body: 'Where the money has to come back from the store rather than from us, the timing is set by Google, Apple and your bank, and we cannot speed it up.',
			},
			{
				kind: 'contact',
				label: 'Support',
				email: CONTACTS.support,
				note: `Response target: ${SLA.supportResponse}.`,
			},
		],
	},

	{
		heading: 'If you are not happy with our answer',
		blocks: [
			{
				kind: 'text',
				body: `You can escalate to our Grievance Officer. Include your original support email so the history is in one place. ${GRIEVANCE_OFFICER.name}, ${GRIEVANCE_OFFICER.designation}, can be reached by email or by post at ${registeredOfficeInline()}.`,
			},
			{
				kind: 'contact',
				label: GRIEVANCE_OFFICER.designation,
				email: GRIEVANCE_OFFICER.email,
				note: `Acknowledged within ${SLA.grievanceAcknowledgement}, resolved within ${SLA.grievanceResolution}.`,
			},
			{
				kind: 'text',
				body: 'If you are still not satisfied, you keep every right you have under the Consumer Protection Act 2019, including approaching the consumer redressal forums.',
			},
		],
	},

	{
		heading: 'Tax invoices and receipts',
		blocks: [
			{
				kind: 'text',
				body: 'The receipt for the payment comes from the store. Google Play or the Apple App Store processes the charge and is the merchant of record for it, and the order confirmation they email you is the record of what you paid, in the currency you paid it, including any tax the store applied at checkout. We do not issue that receipt and we cannot reissue it.',
			},
			{
				kind: 'text',
				body: `${COMPANY.legalName} is the seller of the in-app content itself: the coins, gems and cosmetic items delivered to your account. Our GSTIN is ${COMPANY.gstin} and our CIN is ${COMPANY.cin}. Both are repeated in the seller details below.`,
			},
			{
				kind: 'text',
				body: 'If you need an invoice from us for a purchase, email support and ask for one. Please include:',
			},
			{
				kind: 'list',
				items: [
					'The store order id from your Google Play or Apple receipt.',
					'The date of the purchase.',
					'What you bought, and the amount and currency you were charged.',
					`Your ${APP.name} username and the email address on your account.`,
					'The name and address the invoice should be made out to, and the GSTIN if it is for a business.',
				],
			},
			{
				kind: 'contact',
				label: 'Invoice requests',
				email: CONTACTS.support,
				note: `We aim to reply within ${SLA.supportResponse}.`,
			},
		],
	},

	{
		heading: 'Seller details',
		blocks: [
			{
				kind: 'table',
				headers: ['Detail', 'Value'],
				rows: [
					['Legal name', COMPANY.legalName],
					['CIN', COMPANY.cin],
					['GSTIN', COMPANY.gstin],
					['Registered office', registeredOfficeInline()],
					['Customer care phone', COMPANY.phone],
					['Customer care email', CONTACTS.support],
					['Website', COMPANY.websiteLabel],
				],
			},
		],
	},

	{
		heading: 'Changes to this policy',
		blocks: [
			{
				kind: 'text',
				body: 'We update this page when the way we handle refunds changes. The version and effective date at the top always tell you which version you are reading. Your refund request is judged against the version that was published when you made the purchase.',
			},
		],
	},
]

export default function RefundPolicyPage() {
	return (
		<LegalDocument
			title="Refund & Cancellation Policy"
			intro={`How refunds work for ${APP.name}: in-app purchases, coins and gems, and cosmetic items. Written to be specific, because a vague refund policy is useless to you and non-compliant for us.`}
			version={POLICY_VERSIONS.refunds.version}
			effective={POLICY_VERSIONS.refunds.effective}
			sections={sections}
			footnote={`Published by ${COMPANY.legalName} under the Consumer Protection (E-Commerce) Rules 2020, which require a clearly stated refund, return and cancellation policy. Read it with our Terms of Service and Privacy Policy.`}
		/>
	)
}
