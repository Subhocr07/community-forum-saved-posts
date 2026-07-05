import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/contexts/query-provider";
import { PersonaProvider } from "@/contexts/persona";
import { I18nProvider } from "@/i18n/context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Community Forum — Saved Posts",
  description: "A secure, layered bookmarks slice built with Next.js & Drizzle ORM.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <QueryProvider>
          <I18nProvider>
            <PersonaProvider>
              {children}
            </PersonaProvider>
          </I18nProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
