import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arcstone Pitch Deck Reviewer",
  description: "AI-native fundraising readiness & pitch deck analysis platform for founders.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#090D16] text-slate-100 antialiased selection:bg-blue-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}

