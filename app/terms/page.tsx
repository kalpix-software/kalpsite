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

const SITE = COMPANY.websiteLabel

const sections: Section[] = [
	{
		heading: 'Who these terms are between',
		blocks: [
			{
				kind: 'text',
				body: `These terms are an agreement between you and ${COMPANY.legalName}, a private limited company incorporated in India with its registered office at ${registeredOfficeInline()}. In these terms, "we", "us" and "our" mean ${COMPANY.legalName}, and "you" means the person using the service.`,
			},
			{
				kind: 'text',
				body: `They cover ${APP.name}, the mobile app published under the identifier ${APP.androidPackage}, together with the games, chat, lounges, feeds, store and any other feature we make available through it, and the parts of ${SITE} that support the app. We refer to all of that as "the service".`,
			},
			{
				kind: 'text',
				body: 'You accept these terms when you create an account, or when you use the service. If you do not accept them, do not use the service. If we release a materially changed version and you keep using the service after we tell you about it, that counts as acceptance of the changed version.',
			},
			{
				kind: 'text',
				body: `Three other documents form part of this agreement and are binding on you in the same way: the Community Guidelines at ${SITE}/community-guidelines, the Refund Policy at ${SITE}/refund-policy, and the Privacy Policy at ${SITE}/privacy. Where a specific document says something more detailed than these terms about the same subject, the more detailed document applies.`,
			},
		],
	},
	{
		heading: 'Eligibility',
		blocks: [
			{
				kind: 'text',
				body: `You must be at least ${APP.minimumAge} years old to hold an account. The service is not offered to anyone below that age, and we do not knowingly allow anyone below that age to register.`,
			},
			{
				kind: 'list',
				items: [
					`By using the service you confirm that you are at least ${APP.minimumAge}, that you are able to enter into a binding contract, and that nothing in the law that applies to you prevents you from using a paid gaming and social app.`,
					`You must give accurate registration information and keep it up to date. We do not collect a date of birth when you register, so the confirmation you give that you are at least ${APP.minimumAge} is what we rely on.`,
					'One person, one account. Do not create or operate more than one account for yourself, and do not let anyone else use yours.',
					'We may ask you to confirm or verify your age at any time, and we may ask for a document that shows it. If you do not respond, or the information you gave turns out to be false, we may suspend or close the account.',
					'If we learn that an account holder is below the minimum age, we will close the account and delete the data we hold for it, apart from anything the law requires us to keep.',
				],
			},
			{
				kind: 'text',
				body: 'The service is built for India first but is usable elsewhere. You are responsible for checking that using it is lawful where you are. If it is not, stop using it.',
			},
		],
	},
	{
		heading: 'Your account',
		blocks: [
			{
				kind: 'text',
				body: 'You can sign in with an email address and password, with Google, or as a guest.',
			},
			{
				kind: 'list',
				items: [
					'Keep your password and any one-time codes we send you to yourself. Do not share your login with anyone.',
					'You are responsible for everything that happens under your account, including purchases, messages sent and coins spent, unless it happened because of a failure on our side.',
					'Tell us at once, at ' +
						CONTACTS.support +
						', if you think someone else has access to your account. Until you do, we have no way of telling their activity apart from yours.',
					'Do not sell, rent, share or transfer your account, and do not buy one from anyone else.',
				],
			},
			{
				kind: 'text',
				body: 'A guest account lets you try the service without registering. It is tied to the device and app installation you created it on, and it carries no email address, so there is nothing for us to verify you against. If you sign out, reinstall the app, switch device, or lose the device, a guest account is normally gone for good and we cannot restore it or the balances on it. To keep your progress, upgrade the guest account by adding an email address or linking a Google account. Doing that keeps your username and your existing progress.',
			},
			{
				kind: 'text',
				body: `You can delete your account from inside the app. A registered account enters a ${SLA.accountDeletionGrace} grace period, and signing back in during that window cancels the deletion. A guest account is deleted straight away, with no grace period.`,
			},
		],
	},
	{
		heading: 'Acceptable use',
		blocks: [
			{
				kind: 'text',
				body: `The Community Guidelines at ${SITE}/community-guidelines set out what you may and may not do on the service. They are part of these terms, and breaking them is breaking this agreement. Read them: they are shorter than this page.`,
			},
			{
				kind: 'text',
				body: 'In short, and without cutting down anything in the guidelines, you must not use the service to:',
			},
			{
				kind: 'list',
				items: [
					'Break the law, or help anyone else break it.',
					'Harass, threaten, bully, stalk, impersonate or incite hatred against anyone.',
					'Post or send sexual content involving minors, non-consensual intimate imagery, or anything that sexualises a child. We report this and we cooperate with the authorities.',
					"Post or send content that infringes another person's copyright, trade mark or other rights.",
					'Send spam, run scams, phish for credentials, or advertise real-money gambling or any other product we have not approved.',
					'Attack, probe, overload or reverse engineer the service, or try to reach parts of it you are not meant to reach.',
					'Extract data from the service at scale, whether by scraping, automated collection or otherwise.',
					"Interfere with another player's experience through cheating, exploiting or coordinated abuse. Section 9 covers this in more detail.",
				],
			},
			{
				kind: 'text',
				body: `You can report a message or a user from inside the app, and you can block a user so that they can no longer contact you. Match chat and lounge chat also pass through a profanity filter. If you need to escalate something we did not handle, use the grievance route at ${SITE}/grievance.`,
			},
		],
	},
	{
		heading: 'Your content, and ours',
		blocks: [
			{
				kind: 'text',
				body: 'You keep ownership of everything you create on the service: your messages, photos, videos, voice notes, posts, comments, stories and profile details. We do not claim it and we do not sell it.',
			},
			{
				kind: 'text',
				body: 'To deliver any of it, we need a licence. You give us a worldwide, non-exclusive, royalty-free licence to host, store, copy, reformat, transmit and display your content, strictly for the purpose of operating the service: getting your message to the people you sent it to, showing your post to the audience you chose, generating a thumbnail or a compressed version so it loads on a slow connection, and keeping backups. The licence goes no further than that. It ends when you delete the content or your account, except for copies already sent to other users, and copies we must keep to comply with the law or to deal with an open safety report.',
			},
			{
				kind: 'text',
				body: 'You are responsible for what you upload. You confirm that you have the right to share it and that it does not break the guidelines or the law.',
			},
			{
				kind: 'text',
				body: `We may remove content, limit its reach, or suspend the account behind it when the content breaks the guidelines or the law, when a court or a competent authority orders it, or when leaving it up would put someone at risk. Where we can, we tell the person affected what happened and why. Complaints about a removal, or about a removal we refused to make, go to the Grievance Officer at ${GRIEVANCE_OFFICER.email}, who acknowledges within ${SLA.grievanceAcknowledgement} and resolves within ${SLA.grievanceResolution}.`,
			},
			{
				kind: 'text',
				body: `Everything else in the service belongs to us or to the people who licensed it to us: the ${APP.name} name and logo, the games and their rules, the artwork, the avatars, the card decks, the table backgrounds, the sounds, the code and the site. You get a personal, non-transferable, revocable right to use it inside the app for your own entertainment, and nothing more. Do not copy it, sell it, modify it, decompile it, or build another product out of it.`,
			},
		],
	},
	{
		heading: 'Coins, gems and virtual items',
		blocks: [
			{
				kind: 'callout',
				tone: 'warn',
				body: `Coins and gems are features of a game. They are not money. They have no cash value, they cannot be converted into money or anything worth money, and they cannot be withdrawn from ${APP.name}, ever, by anyone, in any circumstance.`,
			},
			{
				kind: 'text',
				body: `${APP.name} uses two virtual currencies, coins and gems, along with virtual items such as avatars, card decks, table backgrounds and chat themes. They are bought with real money through the app store where in-app purchasing is available, or earned by playing, by claiming daily login rewards and through other in-app activity. This section governs all of them, and it is the section to read most carefully.`,
			},
			{
				kind: 'text',
				body: 'What you receive when you buy or earn coins, gems or an item is a limited, personal, non-exclusive, non-transferable, non-sublicensable and revocable licence to use a feature of the service. That is the whole of what you receive.',
			},
			{
				kind: 'list',
				items: [
					'They are not money, currency or legal tender.',
					'They are not a deposit, a balance held for you, a stored-value instrument, a prepaid payment instrument or e-money. We do not hold funds on your behalf.',
					'They are not a security, an investment, a financial instrument or a virtual digital asset that can be traded.',
					'They are not your property, and you have no ownership right, title or interest in them.',
					'They do not accrue interest, and they cannot be pledged, charged or used as collateral.',
				],
			},
			{
				kind: 'text',
				body: 'No cash value, ever. Coins, gems and virtual items cannot be sold, exchanged, redeemed, cashed out or withdrawn for money, for goods, for services, for cryptocurrency, or for anything else of monetary value, whether inside the app or outside it. There is no mechanism to do so and we will not create one on request. If anyone offers to buy or sell coins, gems, items or accounts for money, that offer breaks these terms and is very likely a scam. Report it.',
			},
			{
				kind: 'text',
				body: 'No transfers. Coins, gems and items are attached to your account and stay there. They cannot be moved to another account, pooled, traded, sold, or given to another player in exchange for anything of value, on the platform or off it. Where the app has a gift feature, it may only be used as the app itself allows, and never as a way of converting a balance into money or of moving value between accounts.',
			},
			{
				kind: 'text',
				body: 'Purchases are final. When you buy coins, gems or an item, you are buying a licence to use it, and it is delivered to your account immediately. Because delivery is immediate and the item is consumed inside a game, purchases are not refundable except where the Refund Policy or the law says otherwise. Section 8 and the Refund Policy explain the exceptions.',
			},
			{
				kind: 'text',
				body: 'We manage the economy. Coins, gems and items are part of a live game, and we may change them. We may change prices and pack sizes, change how much you earn from an activity, change what things cost to buy or to use, add or withdraw items from the store, run limited-time offers, and adjust, reset or remove balances that were created by a fault, a bug, a chargeback, a duplicated transaction or a breach of these terms. Where a change would remove or expire unused items you already hold, we will give you reasonable notice inside the app before it takes effect. None of this gives you a right to compensation in money.',
			},
			{
				kind: 'text',
				body: 'When your account ends, the balances end with it. If you close your account, or we suspend or terminate it under section 11, or we retire the service or a game inside it, every coin, gem and virtual item on the account is forfeited and cannot be recovered, converted or compensated in money. This applies however the balance was obtained, including balances bought with real money, subject only to the Refund Policy and to any right you have under Indian consumer law that cannot be excluded.',
			},
		],
	},
	{
		heading: 'Coins, and what this service is not',
		blocks: [
			{
				kind: 'text',
				body: `${APP.name} offers Tero, a casual multiplayer card game played in 2-player, 3-player, 4-player and 2v2 modes, and Chess. Every game is free to play. There is no entry fee, no stake and no wager of any kind to sit at a table, and nothing of value is ever put at risk on a match.`,
			},
			{
				kind: 'callout',
				tone: 'warn',
				body: `No money, and nothing of monetary value, is ever staked on a match or won from one. ${COMPANY.legalName} does not offer gambling, betting, wagering for money, lotteries, or any game in which a player can win money, a prize, or anything else of monetary value. There is no cash prize, no payout, no withdrawal and no cash-out anywhere in ${APP.name}.`,
			},
			{
				kind: 'text',
				body: 'Coins and gems are in-app items with no cash value. You earn coins by playing, from rewarded ads, daily rewards, quests and referrals, or you may buy them; gems are bought. You spend them only inside the app, on cosmetics and other features — avatars, card decks, table backgrounds, chat themes and the like. They are never staked on a game, and they can never be withdrawn, converted to money, sold or transferred off the platform. A larger balance is worth nothing outside the app and never becomes money.',
			},
			{
				kind: 'text',
				body: 'You must not use coins, gems, gifts, or any other feature as a way of settling a bet made elsewhere, or of moving value between people. Doing that is a serious breach of these terms and we will close the accounts involved and forfeit the balances on them.',
			},
		],
	},
	{
		heading: 'Purchases, billing and refunds',
		blocks: [
			{
				kind: 'text',
				body: 'Purchases in the app are processed through Google Play Billing on Android or the Apple App Store on iOS, depending on where you installed the app. Those stores process the payment, and each is the merchant of record for the transaction. We never see or hold your card details.',
			},
			{
				kind: 'list',
				items: [
					'The price you are shown at checkout is the price the store charges, in the currency the store uses for your account, and it includes taxes where the store applies them.',
					'Your receipt, your billing history and your payment method live in your store account, not in ours.',
					'Because the store is the merchant, a refund is usually granted or refused by Google or Apple under their policies, and their decision is the one that moves the money.',
					'We deliver the coins, gems or item to your account as soon as the store confirms the payment. If the store confirms a payment and nothing arrives, contact us at ' +
						CONTACTS.support +
						' with the store order identifier and we will fix it.',
				],
			},
			{
				kind: 'text',
				body: `Our position on refunds, including when we will support a refund request, what happens to items already used, and how a chargeback affects your account, is set out in the Refund Policy at ${SITE}/refund-policy. That policy is part of these terms. Nothing in either document takes away a right you have under the Consumer Protection Act, 2019 or any other Indian law.`,
			},
			{
				kind: 'text',
				body: 'If a purchase is reversed or charged back after we have delivered it, we may remove the coins, gems or items it paid for. Where the balance has already been spent, we reserve the right to remove other coins, gems or items on the account to the same value, and we may suspend or close the account.',
			},
		],
	},
	{
		heading: 'Fair play',
		blocks: [
			{
				kind: 'text',
				body: 'Matches are only worth playing if they are honest. You must not:',
			},
			{
				kind: 'list',
				items: [
					'Use a bot, script, macro, modified client, emulator-based automation, memory editor or any other tool that plays for you or shows you information the game does not show.',
					'Exploit a bug, a glitch or a mistake in the game, in the store, in the reward system or in the coin economy, instead of reporting it.',
					'Collude with another player, share information between accounts at the same table, or arrange the outcome of a match in advance.',
					'Run more than one account, or use a second account to feed coins, wins, ratings or rewards to a first one.',
					"Deliberately disconnect, stall or drag out a match to avoid a loss or to waste another player's time.",
					'Interfere with matchmaking, ratings, levels or leaderboards, or manipulate them.',
					'Buy, sell or share accounts, or play on behalf of someone else.',
				],
			},
			{
				kind: 'text',
				body: `Where we become aware of any of this, from a report or otherwise, we may investigate it and we may act in proportion to what happened. Depending on the case we may reverse the coins or rewards involved, remove a rating or a leaderboard position, restrict access to matchmaking or to chat, suspend the account, or close it permanently and forfeit the balances on it. Repeat or coordinated abuse gets the stronger end of that list. If you think someone is cheating, report them from inside the app or write to ${CONTACTS.support}.`,
			},
			{
				kind: 'text',
				body: `If you find a bug that gives you an advantage, tell us at ${CONTACTS.support} and do not use it. If you find a security flaw, tell us at ${CONTACTS.security}.`,
			},
		],
	},
	{
		heading: 'The games, and how they may change',
		blocks: [
			{
				kind: 'text',
				body: 'The service is a live product. We may add, change, rebalance or withdraw games, modes, rules, features, cosmetics and rewards, and we may change how matchmaking, ratings, levels and rewards work. We will not remove a paid item you already hold without notice, but the game around it can and will change.',
			},
			{
				kind: 'text',
				body: 'The service depends on your internet connection, your device and services we do not control. We do not promise that it will always be available or free of faults, and we may take it down for maintenance. We will try to do that at quiet hours and to tell you in advance where we can.',
			},
			{
				kind: 'text',
				body: `Matches can end early. A player may disconnect, a device may fail, or we may have to restart a server. When that happens the match simply ends. Because every game is free, there is never an entry fee, a stake or a prize to settle or refund. If you think a match was handled wrongly, contact ${CONTACTS.support} with the approximate time and the game mode and we will look at the match record.`,
			},
		],
	},
	{
		heading: 'Suspension and termination',
		blocks: [
			{
				kind: 'text',
				body: `You can stop using the service whenever you like, and you can delete your account from inside the app. Deletion of a registered account takes effect after a ${SLA.accountDeletionGrace} grace period during which signing back in cancels it. A guest account is deleted immediately.`,
			},
			{
				kind: 'text',
				body: 'We may suspend or close an account, remove content, or restrict a feature where you have broken these terms, the Community Guidelines or the law, where the account is being used to harm someone, where we are required to by a court or a competent authority, or where we reasonably suspect fraud, chargeback abuse or manipulation of the coin economy.',
			},
			{
				kind: 'text',
				body: 'Except where the breach is serious, unlawful or ongoing, we will tell you what the problem is and give you a chance to answer before we close an account permanently. Where an account is closed, you can ask us to review the decision by writing to the Grievance Officer.',
			},
			{
				kind: 'text',
				body: `When an account ends, for whatever reason and started by whichever of us: your access ends, your content stops being shown, and all coins, gems and virtual items on the account are forfeited without compensation. What happens to your personal data is set out in the Privacy Policy at ${SITE}/privacy. Some records are kept longer where tax, accounting or the IT Rules require it, and some are kept to deal with an open safety report or legal claim.`,
			},
			{
				kind: 'text',
				body: 'The parts of these terms that are meant to survive the end of the agreement do survive it: the licence you gave us for content already delivered to other users, the virtual currency clauses, fair play, disclaimers, liability, indemnity and governing law.',
			},
		],
	},
	{
		heading: 'Disclaimers',
		blocks: [
			{
				kind: 'text',
				body: 'We provide the service with reasonable skill and care, and we will keep working on it. Beyond that, and to the extent Indian law allows, the service is provided as it is and as it is available, and we do not give any other warranty about it.',
			},
			{
				kind: 'list',
				items: [
					'We do not promise that the service will be uninterrupted, timely, error-free, or that every bug will be fixed.',
					'We do not promise that the service will meet a particular expectation you have of it, or work with every device or network.',
					'We do not control what other users say or do. Content posted by users is theirs, not ours, and we do not endorse it. We act on reports, but we cannot pre-screen everything.',
					'We do not control the app stores, your device manufacturer, your network operator, or the other third-party services the app depends on.',
					'Nothing in the service is advice of any kind, and gameplay outcomes are entertainment.',
				],
			},
			{
				kind: 'text',
				body: 'Nothing in this section takes away a warranty, guarantee or right that Indian law gives you and does not allow us to exclude, including under the Consumer Protection Act, 2019.',
			},
		],
	},
	{
		heading: 'Limitation of liability',
		blocks: [
			{
				kind: 'text',
				body: 'We do not try to limit our liability where Indian law does not permit it. In particular, nothing in these terms limits or excludes our liability for fraud or fraudulent misrepresentation, for death or personal injury caused by our negligence, for gross negligence or wilful misconduct, or for anything else that the law says cannot be limited, including rights you have as a consumer under the Consumer Protection Act, 2019.',
			},
			{
				kind: 'text',
				body: 'Subject to that, and to the extent Indian law allows:',
			},
			{
				kind: 'list',
				items: [
					'We are liable only for loss that was reasonably foreseeable as a result of our breach, and not for indirect or remote loss.',
					'We are not liable for loss of profit, loss of business or opportunity, loss of goodwill, or for the loss of coins, gems, virtual items, ratings, levels, leaderboard positions or match history, since none of those has monetary value.',
					'We are not liable for what other users do, including anything they say to you, send you or agree with you, or for any arrangement you make with another user outside the service.',
					'We are not liable for a failure caused by something outside our reasonable control, including a network or power failure, an act of a government or regulator, or an outage at a service provider we depend on.',
					'Where we are liable to you in money, our total liability for all claims connected with the service in any twelve-month period is limited to the amount you actually paid us, or paid through the app stores for use of the service, in that same period.',
				],
			},
			{
				kind: 'text',
				body: 'You accept that this allocation of risk is reasonable given that the service is largely free, that anything you buy is virtual, and that it is priced on that basis.',
			},
		],
	},
	{
		heading: 'Indemnity',
		blocks: [
			{
				kind: 'text',
				body: "If a third party brings a claim against us because of something you did, and you did it in breach of these terms, in breach of the law, or in breach of that third party's rights, you agree to cover the loss we actually suffer as a result, including reasonable legal costs.",
			},
			{
				kind: 'text',
				body: 'This applies only to the extent the claim was caused by your act or omission, and does not apply to any part of the loss caused by us. We will tell you promptly about any such claim, will not settle it without asking you first, and will let you take part in the defence.',
			},
		],
	},
	{
		heading: 'Complaints, governing law and jurisdiction',
		blocks: [
			{
				kind: 'text',
				body: `If something goes wrong, start with us. Support questions go to ${CONTACTS.support}. If that does not resolve it, use the grievance mechanism at ${SITE}/grievance, which is our formal complaints route under the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021. The Grievance Officer acknowledges a complaint within ${SLA.grievanceAcknowledgement} and resolves it within ${SLA.grievanceResolution}. We ask you to go through that step before starting any legal proceeding, so that we have a chance to put it right.`,
			},
			{
				kind: 'text',
				body: 'These terms, and any dispute arising out of them or out of your use of the service, whether contractual or not, are governed by the laws of India.',
			},
			{
				kind: 'text',
				body: `The courts having jurisdiction over our registered office at ${registeredOfficeInline()} have exclusive jurisdiction over any such dispute. If you are a consumer, this does not take away your right to bring a complaint before the consumer forum that the Consumer Protection Act, 2019 makes available to you, or any other right you have under a law that cannot be contracted out of.`,
			},
			{
				kind: 'text',
				body: 'If any part of these terms is held to be invalid or unenforceable, the rest continues to apply. If we do not enforce a right straight away, we do not lose it. You may not transfer your rights under these terms to anyone else. We may transfer ours as part of a reorganisation or a sale of the business, and we will tell you if that happens.',
			},
		],
	},
	{
		heading: 'Changes to these terms',
		blocks: [
			{
				kind: 'text',
				body: `We update these terms when the product changes or the law changes. The current version and its effective date are shown at the top of this page, and the history is tracked as version ${POLICY_VERSIONS.terms.version}, effective ${POLICY_VERSIONS.terms.effective}.`,
			},
			{
				kind: 'text',
				body: 'For a minor correction, we update this page. For a change that materially affects your rights or obligations, we will tell you inside the app or by email before it takes effect, and the app will ask you to accept the new version. We also review these terms at least once a year and tell you about the review, as the IT Rules require.',
			},
			{
				kind: 'text',
				body: 'If you do not accept a new version, you should stop using the service and delete your account. Continuing to use the service after a change takes effect means you accept it.',
			},
		],
	},
	{
		heading: 'How to contact us',
		blocks: [
			{
				kind: 'text',
				body: `${COMPANY.legalName}, registered office: ${registeredOfficeInline()}. Website: ${COMPANY.website}.`,
			},
			{
				kind: 'contact',
				label: 'Support and account questions',
				email: CONTACTS.support,
				note: `We aim to reply within ${SLA.supportResponse}.`,
			},
			{
				kind: 'contact',
				label: 'Legal notices',
				email: CONTACTS.legal,
			},
			{
				kind: 'contact',
				label: `${GRIEVANCE_OFFICER.designation} (formal complaints)`,
				email: GRIEVANCE_OFFICER.email,
				note: `${GRIEVANCE_OFFICER.name}, ${GRIEVANCE_OFFICER.designation}, ${COMPANY.legalName}, ${registeredOfficeInline()}. Acknowledgement within ${SLA.grievanceAcknowledgement}, resolution within ${SLA.grievanceResolution}.`,
			},
			{
				kind: 'contact',
				label: 'Privacy and data protection',
				email: CONTACTS.privacy,
			},
		],
	},
]

export default function TermsPage() {
	return (
		<LegalDocument
			title="Terms of Service"
			version={POLICY_VERSIONS.terms.version}
			effective={POLICY_VERSIONS.terms.effective}
			intro={`These terms set out the deal between you and ${COMPANY.legalName} for ${APP.name}. They are written to be read, not to be skipped. The section on coins, gems and what this service is not is the one people ask about most, so start there if you only read one.`}
			sections={sections}
			footnote={`${APP.name} is a casual and skill gaming platform. It offers no gambling, no betting, no wagering for money and no way to win or withdraw money or anything of monetary value. Coins and gems are game features with no cash value.`}
		/>
	)
}
