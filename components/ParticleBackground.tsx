"use client";

import { useMemo } from "react";
import Particles from "react-particles";
import type { Engine, IOptions, RecursivePartial } from "tsparticles-engine";
import { loadSlim } from "tsparticles-slim";

export default function ParticleBackground() {
	const particlesInit = async (engine: Engine) => {
		await loadSlim(engine);
	};

	const options = useMemo<RecursivePartial<IOptions>>(
		() => ({
			background: {
				color: {
					value: "transparent",
				},
			},
			fpsLimit: 120,
			interactivity: {
				events: {
					onClick: {
						enable: true,
						mode: "push",
					},
					onHover: {
						enable: true,
						mode: "repulse",
					},
				},
				modes: {
					push: {
						quantity: 4,
					},
					repulse: {
						distance: 200,
						duration: 0.4,
					},
				},
			},
			particles: {
				color: {
					value: ["#3b82f6", "#8b5cf6", "#ec4899"],
				},
				links: {
					color: "#3b82f6",
					distance: 150,
					enable: true,
					opacity: 0.2,
					width: 1,
				},
				move: {
					direction: "none",
					enable: true,
					outModes: {
						default: "bounce",
					},
					random: false,
					speed: 1,
					straight: false,
				},
				number: {
					density: {
						enable: true,
					},
					value: 80,
				},
				opacity: {
					value: 0.3,
				},
				shape: {
					type: "circle",
				},
				size: {
					value: { min: 1, max: 3 },
				},
			},
			detectRetina: true,
		}),
		[],
	);

	return (
		<Particles
			id="tsparticles"
			init={particlesInit}
			options={options}
			className="absolute inset-0 z-0"
		/>
	);
}
