import Link from "next/link";
import PublicPageLayout from "@/components/PublicPageLayout";
import FadeIn from "@/components/FadeIn";

export default function TermsPage() {
	const sections = [
		{
			title: "1. Acceptance",
			content:
				'By using Kalpix and related services ("Services") operated by Kalpix Software Private Limited ("we"), you agree to these Terms of Service. Registered office: C/O, SUKKHOO PRASAD, O VILL PO, SUNDERPUR, Khojwa Bazar, Varanasi, Varanasi- 221010, Uttar Pradesh, India. Contact: contact@kalpixgames.com.',
		},
		{
			title: "2. Eligibility",
			content:
				"You must be at least the minimum age required by law in your jurisdiction. By using the Services you represent that you meet this requirement and have legal capacity to enter into these Terms.",
		},
		{
			title: "3. Account and conduct",
			content:
				"You are responsible for your account and all activity under it. You agree not to use the Services for illegal purposes, harassment, cheating, or to violate law or third-party rights. We may suspend or terminate accounts that breach these Terms.",
		},
		{
			title: "4. Intellectual property",
			content:
				"Content and materials in our Services are owned by us or our licensors. You may not copy, modify, or distribute without our consent. You retain ownership of content you submit; you grant us a licence to use it to operate the Services.",
		},
		{
			title: "5. Virtual items",
			content:
				"Virtual currency and items are purely virtual, have no real-world monetary value, and cannot be used for gambling or exchanged for cash, prizes, or withdrawals. They are intended only for in-app use (for example to unlock cosmetic items, avatars, or progression). Refunds are subject to our policies and applicable law.",
		},
		{
			title: "6. Disclaimers",
			content:
				'The Services are provided "as is". We disclaim all warranties to the extent permitted by law. We do not guarantee uninterrupted or error-free operation.',
		},
		{
			title: "7. Limitation of liability",
			content:
				"To the maximum extent permitted by law, we shall not be liable for indirect, incidental, or consequential damages. Our total liability shall not exceed the amount you paid us in the twelve months before the claim.",
		},
		{
			title: "8. Governing law",
			content:
				"These Terms are governed by the laws of India. Disputes are subject to the exclusive jurisdiction of the courts at Varanasi, Uttar Pradesh, unless mandatory law requires otherwise.",
		},
		{
			title: "9. Changes",
			content:
				"We may modify these Terms. The updated Terms will be posted here. Continued use after changes constitutes acceptance. If you do not agree, you must stop using the Services.",
		},
	];
	return (
		<PublicPageLayout>
			<div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
				<FadeIn>
					<h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
						Terms of Service
					</h1>
					<p className="text-gray-400 mb-2">Last updated: December 2025</p>
					<p className="text-gray-400 mb-12">
						Please read these Terms of Service carefully before using Kalpix.
					</p>
					<div className="space-y-8">
						{sections.map((s, i) => (
							<section
								key={i}
								className="rounded-2xl bg-slate-800/50 border border-slate-700 p-6"
							>
								<h2 className="text-xl font-semibold text-white mb-3">
									{s.title}
								</h2>
								<p className="text-gray-400 leading-relaxed">{s.content}</p>
							</section>
						))}
					</div>
					<div className="mt-12 text-center">
						<Link
							href="/"
							className="text-blue-400 hover:text-blue-300 transition-colors"
						>
							← Back to home
						</Link>
					</div>
				</FadeIn>
			</div>
		</PublicPageLayout>
	);
}
