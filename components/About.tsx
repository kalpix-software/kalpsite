"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { Target, Heart, Rocket } from "lucide-react";

const values = [
	{
		icon: Target,
		title: "Our Mission",
		description:
			"To create the most engaging and inclusive social platform that brings people together through chat, posts, avatars, and skill-based 2D experiences.",
		color: "from-blue-500 to-cyan-500",
	},
	{
		icon: Heart,
		title: "Our Values",
		description:
			"We believe in community, fairness, and fun. Every feature we build is designed with our players in mind.",
		color: "from-pink-500 to-rose-500",
	},
	{
		icon: Rocket,
		title: "Our Vision",
		description:
			"To be the leading social connection platform where millions of people chat, share moments, and enjoy skill-based 2D experiences together.",
		color: "from-purple-500 to-indigo-500",
	},
];

export default function About() {
	const [ref, inView] = useInView({
		triggerOnce: true,
		threshold: 0.1,
	});

	return (
		<section
			id="about"
			ref={ref}
			className="relative py-32 px-4 sm:px-6 lg:px-8 overflow-hidden"
		>
			<div className="max-w-7xl mx-auto">
				<motion.div
					className="text-center mb-20"
					initial={{ opacity: 0, y: 30 }}
					animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
					transition={{ duration: 0.6 }}
				>
					<h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
						About Kalpix
					</h2>
					<p className="text-xl text-gray-400 max-w-3xl mx-auto">
						We&apos;re building the future of social connection, one interaction
						at a time.
					</p>
				</motion.div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
					{values.map((value, index) => {
						const Icon = value.icon;
						return (
							<motion.div
								key={index}
								className="relative p-8 rounded-2xl bg-slate-800/50 backdrop-blur-sm border border-slate-700 hover:border-slate-600 transition-all"
								initial={{ opacity: 0, y: 50 }}
								animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
								transition={{ duration: 0.6, delay: index * 0.2 }}
								whileHover={{ y: -10, scale: 1.02 }}
							>
								<div
									className={`absolute inset-0 bg-gradient-to-br ${value.color} opacity-0 hover:opacity-10 rounded-2xl transition-opacity duration-300`}
								/>
								<div className="relative z-10">
									<div
										className={`w-16 h-16 rounded-xl bg-gradient-to-br ${value.color} flex items-center justify-center mb-6 shadow-lg`}
									>
										<Icon className="w-8 h-8 text-white" />
									</div>
									<h3 className="text-2xl font-bold mb-4 text-white">
										{value.title}
									</h3>
									<p className="text-gray-400 leading-relaxed">
										{value.description}
									</p>
								</div>
							</motion.div>
						);
					})}
				</div>

				{/* Additional Info */}
				<motion.div
					className="mt-20 text-center"
					initial={{ opacity: 0 }}
					animate={inView ? { opacity: 1 } : { opacity: 0 }}
					transition={{ duration: 0.6, delay: 0.6 }}
				>
					<p className="text-lg text-gray-300 max-w-4xl mx-auto leading-relaxed">
						Kalpix is more than just an app—it&apos;s a community where
						friendships are forged, skills are honed through short 2D
						experiences, and unforgettable moments are created. We&apos;re built
						by{" "}
						<strong className="text-white">
							Kalpix Software Private Limited
						</strong>
						, a company incorporated in India and committed to transparency and
						fair play.
					</p>
					<p className="text-gray-400 mt-4">
						<Link
							href="/about"
							className="text-blue-400 hover:text-blue-300 transition-colors underline"
						>
							Full company details, directors, and registered office →
						</Link>
					</p>
				</motion.div>
			</div>
		</section>
	);
}
