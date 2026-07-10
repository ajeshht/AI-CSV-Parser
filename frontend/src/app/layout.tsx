import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI-Powered CSV Importer | GrowEasy CRM",
  description: "Intelligently map and ingest CRM leads from arbitrary CSV layouts using advanced AI mapping.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

