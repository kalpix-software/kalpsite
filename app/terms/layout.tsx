import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Terms of Service | Kalpix",
	description:
		"Terms of Service for Kalpix. By Kalpix Software Private Limited. Governed by the laws of India.",
};

export default function TermsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
