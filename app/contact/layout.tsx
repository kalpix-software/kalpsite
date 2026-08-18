import type { Metadata } from "next";
import { APP, COMPANY, CONTACTS, registeredOfficeInline } from "@/lib/company";

export const metadata: Metadata = {
	title: `Contact Us | ${APP.name}`,
	description: `Contact ${COMPANY.legalName}, operator of ${APP.name}. Support: ${CONTACTS.support}. Grievances: ${CONTACTS.grievance}. Registered office: ${registeredOfficeInline()}.`,
};

export default function ContactLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
