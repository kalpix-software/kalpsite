import type { Metadata } from "next";
import { APP, COMPANY } from "@/lib/company";

export const metadata: Metadata = {
	title: `Child Safety Standards | ${APP.name}`,
	description: `Child safety standards for ${APP.name} by ${COMPANY.legalName}: zero tolerance for child sexual abuse and exploitation, how to report it, our law enforcement contact, and guidance for parents and guardians.`,
};

export default function ChildSafetyLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
