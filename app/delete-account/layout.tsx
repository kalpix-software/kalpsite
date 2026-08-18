import type { Metadata } from "next";
import { APP } from "@/lib/company";

export const metadata: Metadata = {
	title: `Delete your Account | ${APP.name}`,
	description: `How to delete your ${APP.name} account and the data attached to it, from inside the app or by request from the web, what we keep and why, and what happens to coins and gems.`,
};

export default function DeleteAccountLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
