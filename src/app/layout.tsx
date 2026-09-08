import type { Metadata } from "next";
import "./globals.css";
import "./qualifying-route.css";
import "./starknet-theme.css";
import "./hackathon-polish.css";

export const metadata: Metadata = {
  title: "ZeeroStream Pro",
  description: "A privacy-first creator workspace with receipt-bound access, ZeeroAgent policy logic, and guarded payment lanes.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
