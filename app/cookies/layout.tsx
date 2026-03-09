import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Cookie Policy | Kalpix",
	description:
		"Cookie Policy for Kalpix. How we use cookies and similar technologies. Kalpix Software Private Limited.",
};

export default function CookiesLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
