import type { Metadata } from "next";
import { APP, COMPANY } from "@/lib/company";

export const metadata: Metadata = {
	title: `Grievance Redressal | ${APP.name}`,
	description: `Contact details for the Grievance Officer of ${COMPANY.legalName}, what to include in a complaint about ${APP.name}, and the statutory timelines we follow under the IT Rules 2021.`,
};

export default function GrievanceLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
