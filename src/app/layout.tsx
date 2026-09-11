import type { Metadata } from "next";
import "./globals.css";
import "./qualifying-route.css";
import "./starknet-theme.css";
import "./hackathon-polish.css";

export const metadata: Metadata = {
  title: "Z0Studio",
  description: "A creator platform for public conversation, member rooms, and closer community access.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
