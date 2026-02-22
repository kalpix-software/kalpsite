"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { ArrowRight, Sparkles } from "lucide-react";
import ComingSoonModal from "@/components/ComingSoonModal";

export default function CTA() {
	const [showComingSoon, setShowComingSoon] = useState(false);
	const [ref, inView] = useInView({
		triggerOnce: true,
		threshold: 0.3,
	});

	return (
		<section
			id="contact"
			ref={ref}
			className="relative py-32 px-4 sm:px-6 lg:px-8 overflow-hidden"
		>
			{/* Animated Background */}
			<div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20" />
			<div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-float" />
			<div
				className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-float"
				style={{ animationDelay: "2s" }}
			/>

			<div className="relative max-w-4xl mx-auto text-center">
				<motion.div
					initial={{ opacity: 0, y: 50 }}
					animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
					transition={{ duration: 0.6 }}
				>
					<motion.div
						className="inline-flex items-center px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm font-medium mb-6"
						whileHover={{ scale: 1.05 }}
					>
						<Sparkles className="w-4 h-4 mr-2" />
						Ready to Get Started?
					</motion.div>

					<h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
						Join the Gaming Revolution
					</h2>

					<p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
						Start your journey today and experience the future of social gaming.
						Connect with friends, compete globally, and make every game count.
					</p>

					<div className="flex flex-col sm:flex-row items-center justify-center gap-4">
						<motion.button
							onClick={() => setShowComingSoon(true)}
							className="group px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full text-white font-semibold text-lg flex items-center space-x-2 hover:shadow-2xl hover:shadow-blue-500/50 transition-all"
							whileHover={{ scale: 1.05, y: -2 }}
							whileTap={{ scale: 0.95 }}
						>
							<span>Start Playing Now</span>
							<ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
						</motion.button>

						{/* <motion.button
              className="px-8 py-4 bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-full text-white font-semibold text-lg hover:bg-slate-700/50 transition-all"
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              Learn More
            </motion.button> */}
					</div>

					<ComingSoonModal open={showComingSoon} onClose={() => setShowComingSoon(false)} />

					{/* Trust Indicators */}
					<motion.div
						className="mt-16 flex flex-wrap items-center justify-center gap-8 text-gray-400 text-sm"
						initial={{ opacity: 0 }}
						animate={inView ? { opacity: 1 } : { opacity: 0 }}
						transition={{ duration: 0.6, delay: 0.3 }}
					>
						<div>✓ Free to Play</div>
						<div>✓ No Credit Card Required</div>
						<div>✓ Instant Access</div>
					</motion.div>
				</motion.div>
			</div>
		</section>
	);
}
