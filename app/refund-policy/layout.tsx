import type { Metadata } from "next";
import { APP, COMPANY } from "@/lib/company";

export const metadata: Metadata = {
	title: `Refund & Cancellation Policy | ${APP.name}`,
	description: `Refund and cancellation policy for ${APP.name} by ${COMPANY.legalName}. In-app purchases, coins and gems, failed payments, and how to escalate.`,
};

export default function RefundPolicyLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
