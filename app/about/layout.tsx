import type { Metadata } from "next";
import { APP, COMPANY, registeredOfficeInline } from "@/lib/company";

export const metadata: Metadata = {
	title: `About Us | ${APP.name}`,
	description: `${COMPANY.legalName}, the Indian private limited company behind ${APP.name}. CIN ${COMPANY.cin}. Registered office: ${registeredOfficeInline()}.`,
};

export default function AboutLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
