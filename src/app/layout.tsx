import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "../components/Header";
import { ClerkProvider } from '@clerk/nextjs';
import MergeGuestOnSignIn from "../components/auth/MergeGuestOnSignIn";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Find the Sniper",
  description: "Find hidden snipers in images",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark">
        <head>
          {/* Force dark color scheme so Chrome/iOS don't try to flip colors */}
          <meta name="color-scheme" content="dark" />
          <meta name="theme-color" content="#000000" />
        </head>
        <body
          className={`${geistSans.variable} ${geistMono.variable} min-h-screen text-white antialiased`}
          style={{
            background: `linear-gradient(180deg, rgba(255,115,80,0.05) 0%, rgba(255,174,66,0.04) 35%, rgba(255,209,102,0.03) 60%, rgba(0,0,0,1) 100%), #000`
          }}
        >
          <MergeGuestOnSignIn />
          <Header />
          <main className="max-w-5xl mx-auto p-4">
            {children}
          </main>
        </body>
      </html>
    </ClerkProvider>
  );
}
