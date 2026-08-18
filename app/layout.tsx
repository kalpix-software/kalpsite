import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
	title: "Kalpix - Social Connection & Skill-based Experiences",
	description:
		"Kalpix is a social platform by Kalpix Software Private Limited for chat, posts, avatars, and short skill-based 2D experiences with friends.",
	keywords:
		"Kalpix, social platform, chat, posts, avatars, skill-based experiences, Kalpix Software Private Limited",
	icons: {
		icon: "/kalpix_logo_cropped.jpeg",
	},
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en" className="scroll-smooth">
			<body className={inter.className}>{children}</body>
		</html>
	);
}
