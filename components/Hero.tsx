"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import ComingSoonModal from "@/components/ComingSoonModal";

export default function Hero() {
	const [showComingSoon, setShowComingSoon] = useState(false);
	const [ref, inView] = useInView({
		triggerOnce: true,
		threshold: 0.1,
	});

	const containerVariants = {
		hidden: { opacity: 0 },
		visible: {
			opacity: 1,
			transition: {
				staggerChildren: 0.2,
			},
		},
	};

	const itemVariants = {
		hidden: { opacity: 0, y: 30 },
		visible: {
			opacity: 1,
			y: 0,
			transition: {
				duration: 0.6,
				ease: "easeOut",
			},
		},
	};

	return (
		<section
			id="home"
			ref={ref}
			className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20"
		>
			{/* Animated Background Gradient */}
			<div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-purple-900/20 to-pink-900/20 animate-gradient" />

			{/* Floating Orbs */}
			<div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/30 rounded-full blur-3xl animate-float" />
			<div
				className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl animate-float"
				style={{ animationDelay: "2s" }}
			/>
			<div
				className="absolute top-1/2 left-1/2 w-64 h-64 bg-pink-500/20 rounded-full blur-3xl animate-float"
				style={{ animationDelay: "4s" }}
			/>

			<motion.div
				className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center"
				variants={containerVariants}
				initial="hidden"
				animate={inView ? "visible" : "hidden"}
			>
				<motion.div variants={itemVariants} className="mb-6">
					<motion.span
						className="inline-flex items-center px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm font-medium"
						whileHover={{ scale: 1.05 }}
					>
						<Sparkles className="w-4 h-4 mr-2" />
						Welcome to the Platform Where Players Connect and Compete
					</motion.span>
				</motion.div>

				<motion.h1
					variants={itemVariants}
					className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent leading-tight"
				>
					Create. Connect.
					<br />
					<span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
						Compete.
					</span>
				</motion.h1>

				<motion.p
					variants={itemVariants}
					className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed"
				>
					Connect with friends, compete in skill-based 2D experiences, and
					express yourself through avatars, chat, and social posts.
				</motion.p>

				{/* Featured avatars */}
				<motion.div
					variants={itemVariants}
					className="mb-10 flex items-center justify-center gap-4"
				>
					{["/avatars/1.jpg", "/avatars/2.jpg", "/avatars/3.jpg"].map(
						(src, idx) => (
							<div
								key={src}
								className="relative w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-2 border-purple-400/70 bg-slate-900/70"
								style={{ transform: `translateY(${idx === 1 ? "-6px" : "0"})` }}
							>
								<Image
									src={src}
									alt={`Kalpix avatar ${idx + 1}`}
									fill
									sizes="80px"
									// Focus slightly higher so faces stay centered in the circle crop
									className="object-cover object-[50%_25%]"
									priority={idx === 0}
								/>
							</div>
						),
					)}
				</motion.div>

				<motion.div
					variants={itemVariants}
					className="flex flex-col sm:flex-row items-center justify-center gap-4"
				>
					<motion.button
						onClick={() => setShowComingSoon(true)}
						className="group px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full text-white font-semibold text-lg flex items-center space-x-2 hover:shadow-2xl hover:shadow-blue-500/50 transition-all"
						whileHover={{ scale: 1.05, y: -2 }}
						whileTap={{ scale: 0.95 }}
					>
						<span>Get Started Free</span>
						<ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
					</motion.button>

					<motion.button
						onClick={() => setShowComingSoon(true)}
						className="px-8 py-4 bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-full text-white font-semibold text-lg flex items-center space-x-2 hover:bg-slate-700/50 transition-all"
						whileHover={{ scale: 1.05, y: -2 }}
						whileTap={{ scale: 0.95 }}
					>
						<Play className="w-5 h-5 fill-white" />
						<span>Watch Demo</span>
					</motion.button>
				</motion.div>

				<ComingSoonModal
					open={showComingSoon}
					onClose={() => setShowComingSoon(false)}
				/>

				{/* Pre-launch: no fake stats */}
				<motion.div
					variants={itemVariants}
					className="mt-20 grid grid-cols-3 gap-8 max-w-2xl mx-auto"
				>
					{[
						{ display: "Virtual World", label: "Coming soon" },
						{ display: "Puzzle Master", label: "Coming soon" },
						{ display: "More challenges", label: "On the way" },
					].map((item, index) => (
						<motion.div
							key={index}
							className="text-center"
							whileHover={{ scale: 1.1 }}
						>
							<div className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
								{item.display}
							</div>
							<div className="text-sm text-gray-400 mt-2">{item.label}</div>
						</motion.div>
					))}
				</motion.div>
			</motion.div>

			{/* Scroll Indicator */}
			<motion.div
				className="absolute bottom-10 left-1/2 transform -translate-x-1/2"
				animate={{ y: [0, 10, 0] }}
				transition={{ duration: 2, repeat: Infinity }}
			>
				<div className="w-6 h-10 border-2 border-gray-400 rounded-full flex justify-center">
					<motion.div
						className="w-1 h-3 bg-gray-400 rounded-full mt-2"
						animate={{ y: [0, 12, 0] }}
						transition={{ duration: 2, repeat: Infinity }}
					/>
				</div>
			</motion.div>
		</section>
	);
}
