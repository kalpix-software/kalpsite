"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
	Gamepad2,
	Mail,
	Twitter,
	Github,
	Linkedin,
	Instagram,
} from "lucide-react";

const footerLinks = {
	product: [
		{ name: "Features", href: "/#features" },
		{ name: "Games", href: "/#games" },
		{ name: "App", href: "/#showcase" },
	],
	company: [
		{ name: "About", href: "/about" },
		{ name: "Contact", href: "/contact" },
		{ name: "Admin", href: "/admin/login" },
	],
	legal: [
		{ name: "Privacy Policy", href: "/privacy" },
		{ name: "Terms of Service", href: "/terms" },
		{ name: "Cookie Policy", href: "/cookies" },
	],
};

const socialLinks = [
	// { icon: Twitter, href: "#", label: "Twitter" },
	// { icon: Github, href: "#", label: "GitHub" },
	{
		icon: Linkedin,
		href: "https://www.linkedin.com/in/kalpix-software-b11aab3b2",
		label: "LinkedIn",
	},
	{
		icon: Instagram,
		href: "https://www.instagram.com/kalpix.software",
		label: "Instagram",
	},
];

export default function Footer() {
	return (
		<footer className="relative border-t border-slate-800 bg-slate-900/50 backdrop-blur-sm">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
					{/* Brand */}
					<div className="lg:col-span-1">
						<Link href="/" className="flex items-center space-x-2 mb-4 group">
							<Gamepad2 className="w-8 h-8 text-blue-400 group-hover:text-blue-300 transition-colors" />
							<span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
								Kalpix
							</span>
						</Link>
						<p className="text-gray-400 mb-6 max-w-md">
							The social hub where friends meet, hang out in lounges, and share
							skill-based 2D experiences together.
						</p>
						<div className="flex space-x-4">
							{socialLinks.map((social, index) => {
								const Icon = social.icon;
								return (
									<motion.a
										key={index}
										href={social.href}
										className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-gray-400 hover:text-white hover:bg-slate-700 transition-all"
										whileHover={{ scale: 1.1, y: -2 }}
										whileTap={{ scale: 0.95 }}
										aria-label={social.label}
									>
										<Icon className="w-5 h-5" />
									</motion.a>
								);
							})}
						</div>
					</div>

					{/* Links */}
					<div>
						<h3 className="text-white font-semibold mb-4">Product</h3>
						<ul className="space-y-2">
							{footerLinks.product.map((link, index) => (
								<li key={index}>
									<Link
										href={link.href}
										className="text-gray-400 hover:text-white transition-colors"
									>
										{link.name}
									</Link>
								</li>
							))}
						</ul>
					</div>

					<div>
						<h3 className="text-white font-semibold mb-4">Company</h3>
						<ul className="space-y-2">
							{footerLinks.company.map((link, index) => (
								<li key={index}>
									<Link
										href={link.href}
										className="text-gray-400 hover:text-white transition-colors"
									>
										{link.name}
									</Link>
								</li>
							))}
						</ul>
					</div>

					<div>
						<h3 className="text-white font-semibold mb-4">Legal</h3>
						<ul className="space-y-2">
							{footerLinks.legal.map((link, index) => (
								<li key={index}>
									<Link
										href={link.href}
										className="text-gray-400 hover:text-white transition-colors"
									>
										{link.name}
									</Link>
								</li>
							))}
						</ul>
					</div>
				</div>

				{/* Bottom Bar */}
				<div className="mt-12 pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-3 text-center md:text-left">
					<p className="text-gray-400 text-sm">
						© {new Date().getFullYear()} Kalpix Software Private Limited. Kalpix
						– skill-based casual games &amp; social platform.
					</p>
					{/* <p className="text-gray-400 text-xs md:text-sm max-w-xl">
						Kalpix offers only skill-based games and social features. It
						does not provide real-money gambling, betting, or cash winnings. All
						coins, gems and rewards are virtual and cannot be withdrawn as real
						money.
					</p> */}
				</div>
			</div>
		</footer>
	);
}
