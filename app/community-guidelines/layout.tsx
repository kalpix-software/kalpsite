import type { Metadata } from "next";
import { APP, COMPANY } from "@/lib/company";

export const metadata: Metadata = {
	title: `Community Guidelines | ${APP.name}`,
	description: `The content and conduct standards for ${APP.name} by ${COMPANY.legalName}: what is not allowed, how to report it, what happens after a report, and how to appeal.`,
};

export default function CommunityGuidelinesLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
