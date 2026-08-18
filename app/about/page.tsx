import Link from "next/link";
import PublicPageLayout from "@/components/PublicPageLayout";
import FadeIn from "@/components/FadeIn";
import { Building2, Mail, MapPin, FileCheck } from "lucide-react";
import { APP, COMPANY, CONTACTS } from "@/lib/company";

export default function AboutPage() {
	return (
		<PublicPageLayout>
			<div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
				<FadeIn>
					<h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
						About {COMPANY.shortName}
					</h1>
					<p className="text-gray-400 text-lg mb-12">
						{APP.name} is the social gaming app by {COMPANY.legalName}, built
						around chat, lounges, avatars, and casual multiplayer games.
					</p>

					<div className="space-y-8">
						<section className="rounded-2xl bg-slate-800/50 border border-slate-700 p-6 md:p-8">
							<div className="flex items-center gap-3 mb-4">
								<Building2 className="w-8 h-8 text-blue-400" />
								<h2 className="text-2xl font-semibold text-white">Company</h2>
							</div>
							<p className="text-gray-300 text-lg font-medium">
								{COMPANY.legalName}
							</p>
							<p className="text-gray-400 mt-2">
								A private limited company registered in India. We build and
								operate {APP.name}, a social platform where people connect,
								chat, and play casual multiplayer games together. Our website is{" "}
								<a
									href={COMPANY.website}
									className="text-blue-400 hover:text-blue-300 transition-colors"
								>
									{COMPANY.websiteLabel}
								</a>
								.
							</p>
							<dl className="mt-6 space-y-2 text-sm">
								<div className="flex flex-wrap gap-x-2">
									<dt className="text-gray-400">CIN</dt>
									<dd className="text-gray-300 font-mono">{COMPANY.cin}</dd>
								</div>
								<div className="flex flex-wrap gap-x-2">
									<dt className="text-gray-400">GSTIN</dt>
									<dd className="text-gray-300 font-mono">{COMPANY.gstin}</dd>
								</div>
							</dl>
							<p className="text-gray-400 mt-4 text-sm">
								Our full contact and registration details are on the{" "}
								<Link
									href="/contact"
									className="text-blue-400 hover:text-blue-300 transition-colors"
								>
									contact page
								</Link>
								.
							</p>
						</section>

						<section className="rounded-2xl bg-slate-800/50 border border-slate-700 p-6 md:p-8">
							<div className="flex items-center gap-3 mb-4">
								<Mail className="w-8 h-8 text-green-400" />
								<h2 className="text-2xl font-semibold text-white">Contact</h2>
							</div>
							<a
								href={`mailto:${CONTACTS.general}`}
								className="text-blue-400 hover:text-blue-300 transition-colors"
							>
								{CONTACTS.general}
							</a>
							<p className="text-gray-400 mt-2">
								For business and press enquiries. For help with your account,
								write to{" "}
								<a
									href={`mailto:${CONTACTS.support}`}
									className="text-blue-400 hover:text-blue-300 transition-colors"
								>
									{CONTACTS.support}
								</a>{" "}
								or read the{" "}
								<Link
									href="/help"
									className="text-blue-400 hover:text-blue-300 transition-colors"
								>
									help page
								</Link>
								.
							</p>
						</section>

						<section className="rounded-2xl bg-slate-800/50 border border-slate-700 p-6 md:p-8">
							<div className="flex items-center gap-3 mb-4">
								<MapPin className="w-8 h-8 text-amber-400" />
								<h2 className="text-2xl font-semibold text-white">
									Registered Office
								</h2>
							</div>
							<address className="not-italic text-gray-300 leading-relaxed">
								{COMPANY.registeredOffice.lines.map((line) => (
									<span key={line} className="block">
										{line}
									</span>
								))}
							</address>
						</section>

						<section className="relative z-10 rounded-2xl bg-slate-800/50 border border-slate-700 p-6 md:p-8">
							<div className="flex items-center gap-3 mb-4">
								<FileCheck className="w-8 h-8 text-rose-400" />
								<h2 className="text-2xl font-semibold text-white">Legal</h2>
							</div>
							<p className="text-gray-400 mb-4">
								We are committed to transparency and compliance. Our terms,
								privacy policy, and cookie policy are available for your review.
							</p>
							<div className="flex flex-wrap gap-3">
								<Link
									href="/terms"
									className="inline-block px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors cursor-pointer"
								>
									Terms of Service
								</Link>
								<Link
									href="/privacy"
									className="inline-block px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors cursor-pointer"
								>
									Privacy Policy
								</Link>
								<Link
									href="/cookies"
									className="inline-block px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors cursor-pointer"
								>
									Cookie Policy
								</Link>
							</div>
						</section>
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
