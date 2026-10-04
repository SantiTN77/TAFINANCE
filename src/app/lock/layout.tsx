import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acceso — TAFINANCE",
  robots: { index: false, follow: false },
};

export default function LockLayout({ children }: { children: React.ReactNode }) {
  return children;
}
