import type { Metadata } from "next";
import { APP, COMPANY } from "@/lib/company";

export const metadata: Metadata = {
	title: `Cookie Policy | ${APP.name}`,
	description: `Which cookies ${COMPANY.legalName} sets on ${COMPANY.websiteLabel}, what each one is for and how long it lasts. No analytics, advertising or third-party tracking cookies on this site.`,
};

export default function CookiesLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
