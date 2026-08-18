import type { Metadata } from "next";
import { APP } from "@/lib/company";

export const metadata: Metadata = {
	title: `Help and Support | ${APP.name}`,
	description: `Answers to common questions about ${APP.name}: accounts, sign-in, coins and gems, purchases, safety, notifications and account deletion. Plus how to reach a human.`,
};

export default function HelpLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
