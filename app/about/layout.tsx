import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "About Us | Kalpix - Kalpix Software Private Limited",
	description:
		"Kalpix Software Private Limited. Incorporated 4 December 2025. Directors: Dayanidhi Gupta, Anchal Gupta. Registered office in Varanasi, Uttar Pradesh.",
};

export default function AboutLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
